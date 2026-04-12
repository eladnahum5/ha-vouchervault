"""HTTP-level tests for VoucherVaultApiClient.

Uses aioresponses for pure HTTP client tests and a local aiohttp web server
(with ``@pytest.mark.enable_socket``) for login flows so Set-Cookie and the
cookie jar behave like production.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock, patch

import aiohttp
import aioresponses
import pytest
from aiohttp import web

from custom_components.vouchervault.vouchervault import ApiData, VoucherVaultApiClient

_socket = pytest.mark.enable_socket


@pytest.fixture
def client() -> VoucherVaultApiClient:
    """API client targeting loopback test URLs."""
    return VoucherVaultApiClient(
        host="127.0.0.1",
        port=8000,
        username="user",
        password="pass",
        api_token="test-token",
    )


def _stats_payload() -> dict[str, Any]:
    return {
        "item_stats": {"total_items": 1},
        "user_stats": {"total_users": 1},
        "issuer_stats": [],
        "item_details": [],
    }


async def _start_site(
    app: web.Application,
) -> tuple[web.AppRunner, int]:
    """Bind an app on 127.0.0.1 with an ephemeral port."""
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", 0)
    await site.start()
    assert site._server is not None
    sock = site._server.sockets[0]
    _host, port, *_ = sock.getsockname()
    return runner, int(port)


async def _cleanup_runner(runner: web.AppRunner) -> None:
    await runner.cleanup()


def _client_for_port(port: int) -> VoucherVaultApiClient:
    return VoucherVaultApiClient(
        host="127.0.0.1",
        port=port,
        username="user",
        password="pass",
        api_token="test-token",
    )


@asynccontextmanager
async def _login_app(
    *,
    login_post_status: int = 302,
    toggle_post_status: int | None = None,
    include_stats: bool = False,
) -> AsyncIterator[tuple[VoucherVaultApiClient, web.AppRunner]]:
    """Local server: GET login sets csrftoken cookie; POST login; optional stats and toggle."""
    app = web.Application()

    async def login_get(_request: web.Request) -> web.StreamResponse:
        resp = web.Response(text="<html></html>")
        resp.set_cookie("csrftoken", "abc123", path="/")
        return resp

    async def login_post(_request: web.Request) -> web.StreamResponse:
        return web.Response(status=login_post_status, text="login")

    app.router.add_get("/en/accounts/login/", login_get)
    app.router.add_post("/en/accounts/login/", login_post)

    if include_stats:

        async def stats(request: web.Request) -> web.StreamResponse:
            auth = request.headers.get("Authorization", "")
            if "Bearer" not in auth:
                return web.Response(status=401)
            return web.json_response(_stats_payload())

        app.router.add_get("/en/api/get/stats", stats)

    if toggle_post_status is not None:

        async def toggle_post(_request: web.Request) -> web.StreamResponse:
            return web.Response(status=toggle_post_status, text="toggle")

        app.router.add_post("/en/items/toggle_status/item-1", toggle_post)

    runner, port = await _start_site(app)
    try:
        yield _client_for_port(port), runner
    finally:
        await _cleanup_runner(runner)


async def test_send_api_request_get_json_success(client: VoucherVaultApiClient) -> None:
    """GET returns parsed JSON on 200."""
    url = "http://127.0.0.1:8000/en/api/get/stats"
    with aioresponses.aioresponses() as mocked:
        mocked.get(url, status=200, payload=_stats_payload())
        result = await client.send_api_request("GET", "/en/api/get/stats")
    assert result == _stats_payload()


async def test_send_api_request_non_200_returns_none(
    client: VoucherVaultApiClient,
) -> None:
    """Non-success status yields None."""
    url = "http://127.0.0.1:8000/en/api/get/stats"
    with aioresponses.aioresponses() as mocked:
        mocked.get(url, status=401, body="Unauthorized")
        result = await client.send_api_request("GET", "/en/api/get/stats")
    assert result is None


async def test_send_api_request_client_error_returns_none(
    client: VoucherVaultApiClient,
) -> None:
    """aiohttp.ClientError is caught and returns None."""
    with aioresponses.aioresponses() as mocked:
        mocked.get(
            "http://127.0.0.1:8000/en/api/get/stats",
            exception=aiohttp.ClientConnectionError("boom"),
        )
        result = await client.send_api_request("GET", "/en/api/get/stats")
    assert result is None


async def test_send_api_request_invalid_json_returns_none(
    client: VoucherVaultApiClient,
) -> None:
    """200 with non-JSON body yields None (ContentTypeError)."""
    url = "http://127.0.0.1:8000/en/api/get/stats"
    with aioresponses.aioresponses() as mocked:
        mocked.get(url, status=200, body="not json", content_type="text/plain")
        result = await client.send_api_request("GET", "/en/api/get/stats")
    assert result is None


async def test_get_stats_uses_send_api_request(
    client: VoucherVaultApiClient,
) -> None:
    """get_stats returns ApiData built from HTTP response."""
    url = "http://127.0.0.1:8000/en/api/get/stats"
    with aioresponses.aioresponses() as mocked:
        mocked.get(url, status=200, payload=_stats_payload())
        data = await client.get_stats()
    assert isinstance(data, ApiData)
    assert data.item_stats["total_items"] == 1


async def test_login_get_non_200_returns_none(client: VoucherVaultApiClient) -> None:
    """Login page GET failure closes session and returns None."""
    with aioresponses.aioresponses() as mocked:
        mocked.get("http://127.0.0.1:8000/en/accounts/login/", status=503)
        session = await client.login_and_get_session()
    assert session is None


async def test_login_missing_csrf_returns_none(client: VoucherVaultApiClient) -> None:
    """200 login page without csrftoken cookie returns None."""
    with aioresponses.aioresponses() as mocked:
        mocked.get(
            "http://127.0.0.1:8000/en/accounts/login/",
            status=200,
            body="<html></html>",
        )
        session = await client.login_and_get_session()
    assert session is None


@_socket
async def test_login_post_not_redirect_returns_none() -> None:
    """POST login must return 302 (real cookie from Set-Cookie on GET)."""
    async with _login_app(login_post_status=200) as (srv_client, _runner):
        session = await srv_client.login_and_get_session()
    assert session is None


@_socket
async def test_login_success_returns_session() -> None:
    """Successful CSRF cookie + 302 login returns an open session."""
    async with _login_app(login_post_status=302) as (srv_client, _runner):
        session = await srv_client.login_and_get_session()
    assert session is not None
    assert isinstance(session, aiohttp.ClientSession)
    await session.close()


async def test_send_post_with_session_fails_without_login(
    client: VoucherVaultApiClient,
) -> None:
    """When login fails, send_post_with_session returns failure dict."""
    with aioresponses.aioresponses() as mocked:
        mocked.get("http://127.0.0.1:8000/en/accounts/login/", status=404)
        result = await client.send_post_with_session(
            "POST", "/en/items/toggle_status/x", data={}
        )
    assert result == {"success": False}


@_socket
async def test_send_post_with_session_success() -> None:
    """Full login + POST with 302 returns success (real session cookies)."""
    async with _login_app(login_post_status=302, toggle_post_status=302) as (
        srv_client,
        _runner,
    ):
        result = await srv_client.send_post_with_session(
            "POST", "/en/items/toggle_status/item-1", data={}
        )
    assert result == {"success": True}


@_socket
async def test_send_post_with_session_non_redirect_fails() -> None:
    """Authenticated POST that is not 302 returns failure."""
    async with _login_app(login_post_status=302, toggle_post_status=400) as (
        srv_client,
        _runner,
    ):
        result = await srv_client.send_post_with_session(
            "POST", "/en/items/toggle_status/item-1", data={}
        )
    assert result == {"success": False}


@_socket
async def test_test_connection_success() -> None:
    """test_connection succeeds when token and basic auth paths work."""
    async with _login_app(
        login_post_status=302,
        include_stats=True,
    ) as (srv_client, _runner):
        ok = await srv_client.test_connection()
    assert ok is True


async def test_test_connection_false_when_stats_unauthorized(
    client: VoucherVaultApiClient,
) -> None:
    """401 on stats fails token authentication (basic path still runs)."""
    with aioresponses.aioresponses() as mocked:
        mocked.get("http://127.0.0.1:8000/en/api/get/stats", status=401)
        mocked.get("http://127.0.0.1:8000/en/accounts/login/", status=503)
        ok = await client.test_connection()
    assert ok is False


async def test_test_connection_false_when_basic_fails(
    client: VoucherVaultApiClient,
) -> None:
    """test_connection is False if login flow fails."""
    with aioresponses.aioresponses() as mocked:
        mocked.get(
            "http://127.0.0.1:8000/en/api/get/stats",
            status=200,
            payload=_stats_payload(),
        )
        mocked.get("http://127.0.0.1:8000/en/accounts/login/", status=503)
        ok = await client.test_connection()
    assert ok is False


async def test_test_connection_false_when_token_auth_fails(
    client: VoucherVaultApiClient,
) -> None:
    """test_connection is False when authenticate_token fails."""
    with (
        patch.object(client, "authenticate_token", new=AsyncMock(return_value=False)),
        patch.object(client, "authenticate_basic", new=AsyncMock(return_value=True)),
    ):
        ok = await client.test_connection()
    assert ok is False


async def test_login_client_error_returns_none(client: VoucherVaultApiClient) -> None:
    """ClientError during login GET is handled."""
    with aioresponses.aioresponses() as mocked:
        mocked.get(
            "http://127.0.0.1:8000/en/accounts/login/",
            exception=aiohttp.ClientConnectionError("refused"),
        )
        session = await client.login_and_get_session()
    assert session is None
