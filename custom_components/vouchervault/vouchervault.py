"""VoucherVault API client."""

from __future__ import annotations

from dataclasses import dataclass, field
import logging
from typing import Any

import aiohttp
from yarl import URL

_LOGGER = logging.getLogger(__name__)


@dataclass
class ApiData:
    """Typed snapshot of the full API response."""

    item_stats: dict[str, Any] = field(default_factory=dict)
    user_stats: dict[str, Any] = field(default_factory=dict)
    issuer_stats: list[dict[str, Any]] = field(default_factory=list)
    item_details: list[dict[str, Any]] = field(default_factory=list)

    @classmethod
    def from_api_response(cls, raw: dict[str, Any]) -> ApiData:
        """Parse the raw API JSON into a typed ApiData instance."""
        return cls(
            item_stats=raw.get("item_stats", {}),
            user_stats=raw.get("user_stats", {}),
            issuer_stats=raw.get("issuer_stats", []),
            item_details=raw.get("item_details", []),
        )


class VoucherVaultApiClient:
    """Client to interact with VoucherVault."""

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        api_token: str,
    ) -> None:
        """Initialize the client."""

        self.host = host
        self.port = port
        self.url = f"http://{host}:{port}"
        self.username = username
        self.password = password
        self.api_token = api_token

    async def test_connection(self) -> bool:
        """Test the connection to the API using the provided credentials."""
        token_valid = await self.authenticate_token()
        basic_valid = await self.authenticate_basic()
        return token_valid and basic_valid

    async def authenticate_token(self) -> bool:
        """Verify the token is valid by fetching statistics from the API."""
        _LOGGER.debug("Authenticating with API token to verify access")
        raw = await self.send_api_request("GET", "/en/api/get/stats")
        if raw is None:
            _LOGGER.error("API token authentication failed")
            return False
        _LOGGER.debug("API token authentication successful")
        return True

    async def authenticate_basic(self) -> bool:
        """Verify the username and password are valid by performing a login action to obtain a session cookie."""
        _LOGGER.debug(
            "Authenticating with basic credentials to verify username and password"
        )
        session = await self.login_and_get_session()
        if session is None:
            _LOGGER.error(
                "Basic authentication failed with provided username and password"
            )
            return False
        await session.close()
        _LOGGER.debug(
            "Basic authentication successful with provided username and password"
        )
        return True

    async def login_and_get_session(self) -> aiohttp.ClientSession | None:
        """Perform the login action to obtain a session cookie for future authenticated requests."""
        _LOGGER.debug("Performing login action to obtain session cookie")

        # Create a new session with a cookie jar to store cookies across requests
        connector = aiohttp.TCPConnector(force_close=True)
        jar = aiohttp.CookieJar(unsafe=True)
        session = aiohttp.ClientSession(connector=connector, cookie_jar=jar)
        login_url_str = f"{self.url}/en/accounts/login/"
        login_url = URL(login_url_str)

        try:
            # First, access the login page to get the CSRF token cookie
            async with session.get(login_url_str) as resp:
                if resp.status != 200:
                    await session.close()
                    _LOGGER.error(
                        "Failed to access login page, status code: %s", resp.status
                    )
                    return None
                _LOGGER.debug(
                    "Login page accessed successfully, now submitting credentials"
                )

            # Extract the CSRF token from the cookie jar
            csrf_token = jar.filter_cookies(login_url).get("csrftoken")
            if not csrf_token:
                await session.close()
                _LOGGER.error("CSRF token not found in login response cookies")
                return None

            payload = {
                "username": self.username,
                "password": self.password,
                "csrfmiddlewaretoken": csrf_token.value,
            }

            headers = {
                "Referer": login_url_str,
            }

            # Submit the login form with credentials and CSRF token
            async with session.post(
                login_url_str, data=payload, headers=headers, allow_redirects=False
            ) as resp:
                if resp.status != 302:
                    await session.close()
                    _LOGGER.error(
                        "Login failed, expected redirect but got status %s", resp.status
                    )
                    return None
                _LOGGER.debug("Login successful, session cookie obtained")
        except aiohttp.ClientError as e:
            await session.close()
            _LOGGER.error("Login request failed: %s", e)
            return None

        return session

    async def send_post_with_session(
        self, request_type: str, endpoint: str, data: dict[str, Any] | None = None
    ) -> dict[str, bool]:
        """Helper method to perform authenticated POST requests using a session cookie."""
        session = await self.login_and_get_session()
        if session is None:
            _LOGGER.error(
                "Cannot perform basic authenticated request without valid session"
            )
            return {"success": False}
        url_str = f"{self.url}{endpoint}"
        post_url = URL(url_str)
        form = dict(data or {})
        csrf = session.cookie_jar.filter_cookies(post_url).get("csrftoken")
        if not csrf:
            await session.close()
            _LOGGER.error("CSRF token not found for authenticated POST")
            return {"success": False}
        form["csrfmiddlewaretoken"] = csrf.value
        async with session.post(url_str, data=form, allow_redirects=False) as resp:
            if resp.status != 302:
                _LOGGER.error(
                    "Authenticated API request failed, expected redirect but got status %s",
                    resp.status,
                )
                await session.close()
                return {"success": False}
            _LOGGER.debug("Authenticated API request successful with session cookie")
            await session.close()
            return {"success": True}

    async def send_api_request(
        self, request_type: str, endpoint: str, data: dict[str, Any] | None = None
    ) -> dict | None:
        """Helper method to perform requests to the API.

        Request type can be GET, POST, PATCH, DELETE.
        """
        _LOGGER.debug("Sending API request: %s %s", request_type, endpoint)
        url = f"{self.url}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
        }

        http_session = aiohttp.ClientSession()
        try:
            async with http_session.request(
                request_type, url, headers=headers, json=data
            ) as response:
                if response.status in (200, 201):
                    try:
                        return await response.json()
                    except aiohttp.ContentTypeError:
                        return None
                else:
                    _LOGGER.error(
                        "API request failed: %s %s - Status: %s",
                        request_type,
                        url,
                        response.status,
                    )
                    return None
        except aiohttp.ClientError as e:
            _LOGGER.error("API request error: %s", e)
            return None
        finally:
            await http_session.close()

    async def get_stats(
        self,
    ) -> ApiData:
        """Fetch global stats from the API.

        Example curl:
        curl -H "Authorization: Bearer <API-TOKEN>" http://127.0.0.1:8000/en/api/get/stats
        """
        raw_data = await self.send_api_request("GET", "/en/api/get/stats")
        if raw_data is None:
            return ApiData()
        return ApiData.from_api_response(raw_data)

    async def toggle_item_status(self, item_id: str) -> bool:
        """Toggle the status of an item (e.g. redeem/unredeem a voucher)."""
        _LOGGER.debug("Toggling status for item %s", item_id)
        endpoint = f"/en/items/toggle_status/{item_id}"
        resp = await self.send_post_with_session("POST", endpoint, data={})
        if resp.get("success"):
            _LOGGER.info("Successfully toggled status for item %s", item_id)
        else:
            _LOGGER.error("Failed to toggle status for item %s", item_id)
