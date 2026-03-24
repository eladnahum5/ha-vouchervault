"""Common fixtures for the VoucherVault tests."""

from collections.abc import Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant.components.lovelace.const import DOMAIN as LOVELACE_DOMAIN
from homeassistant.components.lovelace.resources import ResourceStorageCollection
from homeassistant.const import (
    CONF_API_TOKEN,
    CONF_HOST,
    CONF_PASSWORD,
    CONF_PORT,
    CONF_USERNAME,
)
from homeassistant.core import HomeAssistant

from custom_components.vouchervault.const import DOMAIN
from custom_components.vouchervault.vouchervault import ApiData


@pytest.fixture(autouse=True)
def mock_frontend_setup() -> Generator[None]:
    """Mock the frontend component setup to avoid the missing hass_frontend dependency."""
    with patch(
        "homeassistant.components.frontend.async_setup", return_value=True
    ):
        yield


@pytest.fixture(autouse=True)
def mock_register_static_paths() -> Generator[None]:
    """Mock async_register_static_paths to avoid file-system access in tests."""
    with patch(
        "homeassistant.components.http.HomeAssistantHTTP.async_register_static_paths",
        new=AsyncMock(),
    ):
        yield


@pytest.fixture(autouse=True)
def mock_lovelace_resources(hass: HomeAssistant) -> AsyncMock:
    """Populate hass.data with a mock Lovelace ResourceStorageCollection.

    This prevents KeyError in _async_register_lovelace_resource and lets the
    default storage-mode code path run during all tests.
    """
    mock_resources = AsyncMock(spec=ResourceStorageCollection)
    mock_resources.loaded = False
    mock_resources.async_items.return_value = []
    mock_resources.async_create_item.return_value = {"id": "test-resource-id"}

    hass.data[LOVELACE_DOMAIN] = {"resources": mock_resources}

    return mock_resources

MOCK_CONFIG = {
    CONF_HOST: "192.168.1.100",
    CONF_PORT: 8000,
    CONF_USERNAME: "testuser",
    CONF_PASSWORD: "testpass",
    CONF_API_TOKEN: "test-api-token",
}

MOCK_API_DATA = ApiData(
    item_stats={
        "total_items": 10,
        "total_value": 250.0,
        "vouchers": 5,
        "giftcards": 3,
        "coupons": 2,
        "loyaltycards": 0,
        "used_items": 2,
        "available_items": 7,
        "expired_items": 1,
        "soon_expiring_items": 1,
    },
    user_stats={
        "total_users": 3,
        "active_users": 3,
        "disabled_users": 0,
        "superusers": 1,
        "staff_members": 1,
    },
    issuer_stats=[
        {"issuer": "Store A", "count": 5, "total_value": 150.0},
        {"issuer": "Store B", "count": 5, "total_value": 100.0},
    ],
    item_details=[
        {
            "id": "abc123",
            "type": "voucher",
            "name": "Test Voucher",
            "issuer": "Store A",
            "value": "50.0",
            "value_type": "fixed",
            "issue_date": "2024-01-01",
            "expiry_date": "2025-12-31",
            "description": "A test voucher",
            "is_used": False,
            "user__username": "testuser",
            "redeem_code": "TESTCODE123",
            "code_type": "text",
            "pin": None,
        }
    ],
)


@pytest.fixture
def mock_config_entry() -> MockConfigEntry:
    """Return a mock config entry."""
    return MockConfigEntry(
        domain=DOMAIN,
        title="192.168.1.100:8000",
        data=MOCK_CONFIG,
        unique_id=f"{MOCK_CONFIG[CONF_HOST]}_{MOCK_CONFIG[CONF_PORT]}",
    )


@pytest.fixture
def mock_vouchervault_client() -> Generator[MagicMock]:
    """Mock the VoucherVaultApiClient constructor and return value."""
    with patch(
        "custom_components.vouchervault.coordinator.VoucherVaultApiClient"
    ) as mock_client_class:
        mock_client = AsyncMock()
        mock_client.get_stats.return_value = MOCK_API_DATA
        mock_client.toggle_item_status.return_value = True
        mock_client.test_connection.return_value = True
        mock_client_class.return_value = mock_client
        yield mock_client


@pytest.fixture
async def init_integration(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
    mock_vouchervault_client: MagicMock,
) -> MockConfigEntry:
    """Set up the VoucherVault integration for testing."""
    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()
    return mock_config_entry


@pytest.fixture
def mock_setup_entry() -> Generator[AsyncMock]:
    """Override async_setup_entry."""
    with patch(
        "custom_components.vouchervault.async_setup_entry", return_value=True
    ) as mock_setup_entry:
        yield mock_setup_entry
