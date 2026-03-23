"""Tests for the VoucherVault API client."""

from unittest.mock import AsyncMock, patch

import pytest

from custom_components.vouchervault.vouchervault import ApiData, VoucherVaultApiClient


def test_api_data_from_api_response_full() -> None:
    """Test ApiData.from_api_response parses all fields correctly."""
    raw = {
        "item_stats": {"total_items": 5},
        "user_stats": {"total_users": 2},
        "issuer_stats": [{"issuer": "Store A", "count": 3, "total_value": 100.0}],
        "item_details": [{"id": "xyz", "name": "Test"}],
    }
    data = ApiData.from_api_response(raw)
    assert data.item_stats == {"total_items": 5}
    assert data.user_stats == {"total_users": 2}
    assert len(data.issuer_stats) == 1
    assert data.issuer_stats[0]["issuer"] == "Store A"
    assert len(data.item_details) == 1
    assert data.item_details[0]["id"] == "xyz"


def test_api_data_from_api_response_defaults() -> None:
    """Test ApiData.from_api_response uses empty defaults for missing fields."""
    data = ApiData.from_api_response({})
    assert data.item_stats == {}
    assert data.user_stats == {}
    assert data.issuer_stats == []
    assert data.item_details == []


@pytest.fixture
def client() -> VoucherVaultApiClient:
    """Return a VoucherVaultApiClient instance with dummy credentials."""
    return VoucherVaultApiClient(
        host="localhost",
        port=8000,
        username="user",
        password="pass",
        api_token="token",
    )


async def test_get_stats_returns_empty_api_data_when_api_returns_none(
    client: VoucherVaultApiClient,
) -> None:
    """Test get_stats returns an empty ApiData when the API returns None."""
    with patch.object(client, "send_api_request", new=AsyncMock(return_value=None)):
        result = await client.get_stats()
    assert result.item_stats == {}
    assert result.user_stats == {}
    assert result.issuer_stats == []
    assert result.item_details == []


async def test_get_stats_returns_parsed_data(
    client: VoucherVaultApiClient,
) -> None:
    """Test get_stats returns a correctly parsed ApiData on success."""
    raw = {
        "item_stats": {"total_items": 7},
        "user_stats": {"total_users": 1},
        "issuer_stats": [],
        "item_details": [],
    }
    with patch.object(client, "send_api_request", new=AsyncMock(return_value=raw)):
        result = await client.get_stats()
    assert result.item_stats["total_items"] == 7
    assert result.user_stats["total_users"] == 1


async def test_toggle_item_status_calls_correct_endpoint(
    client: VoucherVaultApiClient,
) -> None:
    """Test toggle_item_status calls send_post_with_session with the right endpoint."""
    mock_post = AsyncMock(return_value={"success": True})
    with patch.object(client, "send_post_with_session", new=mock_post):
        await client.toggle_item_status("item-42")
    mock_post.assert_called_once_with("POST", "/en/items/toggle_status/item-42", data={})


async def test_toggle_item_status_logs_on_failure(
    client: VoucherVaultApiClient,
) -> None:
    """Test toggle_item_status does not raise when the API reports failure."""
    with patch.object(
        client, "send_post_with_session", new=AsyncMock(return_value={"success": False})
    ):
        await client.toggle_item_status("item-99")
