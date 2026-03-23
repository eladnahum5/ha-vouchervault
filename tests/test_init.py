"""Tests for VoucherVault integration setup and teardown."""

from unittest.mock import AsyncMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant

from custom_components.vouchervault.const import DOMAIN

pytestmark = pytest.mark.usefixtures("enable_custom_integrations")


async def test_setup_entry(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
) -> None:
    """Test successful integration setup."""
    assert init_integration.state is ConfigEntryState.LOADED


async def test_unload_entry(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
) -> None:
    """Test successful unloading of the config entry."""
    assert init_integration.state is ConfigEntryState.LOADED

    assert await hass.config_entries.async_unload(init_integration.entry_id)
    await hass.async_block_till_done()

    assert init_integration.state is ConfigEntryState.NOT_LOADED


async def test_service_registered(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
) -> None:
    """Test the toggle_item_status service is registered after setup."""
    assert hass.services.has_service(DOMAIN, "toggle_item_status")


async def test_service_unregistered_on_unload(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
) -> None:
    """Test the toggle_item_status service is removed after unload."""
    assert hass.services.has_service(DOMAIN, "toggle_item_status")

    await hass.config_entries.async_unload(init_integration.entry_id)
    await hass.async_block_till_done()

    assert not hass.services.has_service(DOMAIN, "toggle_item_status")


async def test_service_toggle_item_status_calls_client(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    mock_vouchervault_client: AsyncMock,
) -> None:
    """Test that calling toggle_item_status service invokes the API client."""
    await hass.services.async_call(
        DOMAIN,
        "toggle_item_status",
        {"item_id": "abc123"},
        blocking=True,
    )
    mock_vouchervault_client.toggle_item_status.assert_called_once_with("abc123")


async def test_service_toggle_item_status_no_item_id(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    mock_vouchervault_client: AsyncMock,
) -> None:
    """Test that calling toggle_item_status without item_id does not call the client."""
    await hass.services.async_call(
        DOMAIN,
        "toggle_item_status",
        {},
        blocking=True,
    )
    mock_vouchervault_client.toggle_item_status.assert_not_called()


async def test_setup_entry_coordinator_failure(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
    mock_vouchervault_client: AsyncMock,
) -> None:
    """Test entry goes to SETUP_RETRY when first refresh times out."""
    mock_vouchervault_client.get_stats.side_effect = TimeoutError

    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    assert mock_config_entry.state is ConfigEntryState.SETUP_RETRY
