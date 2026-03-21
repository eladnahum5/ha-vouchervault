"""Tests for the VoucherVault coordinator."""

from unittest.mock import AsyncMock

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import UpdateFailed

from custom_components.vouchervault.coordinator import VoucherVaultCoordinator

pytestmark = pytest.mark.usefixtures("enable_custom_integrations")


async def test_coordinator_stores_data_after_setup(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
) -> None:
    """Test coordinator holds the expected data after a successful first refresh."""
    coordinator: VoucherVaultCoordinator = init_integration.runtime_data

    assert coordinator.data is not None
    assert coordinator.data.item_stats["total_items"] == 10
    assert coordinator.data.user_stats["total_users"] == 3
    assert len(coordinator.data.issuer_stats) == 2
    assert len(coordinator.data.item_details) == 1


async def test_coordinator_update_raises_update_failed_on_timeout(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
    mock_vouchervault_client: AsyncMock,
) -> None:
    """Test that a TimeoutError during first refresh causes SETUP_RETRY."""
    mock_vouchervault_client.get_stats.side_effect = TimeoutError

    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    assert mock_config_entry.state is ConfigEntryState.SETUP_RETRY


async def test_coordinator_update_raises_update_failed_on_api_error(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
    mock_vouchervault_client: AsyncMock,
) -> None:
    """Test that an UpdateFailed during first refresh causes SETUP_RETRY."""
    mock_vouchervault_client.get_stats.side_effect = UpdateFailed("API error")

    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    assert mock_config_entry.state is ConfigEntryState.SETUP_RETRY


async def test_coordinator_refresh_updates_data(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    mock_vouchervault_client: AsyncMock,
) -> None:
    """Test coordinator data is updated after a manual refresh."""
    from tests.conftest import MOCK_API_DATA
    from custom_components.vouchervault.vouchervault import ApiData

    coordinator: VoucherVaultCoordinator = init_integration.runtime_data

    updated_data = ApiData(
        item_stats={**MOCK_API_DATA.item_stats, "total_items": 20},
        user_stats=MOCK_API_DATA.user_stats,
        issuer_stats=MOCK_API_DATA.issuer_stats,
        item_details=MOCK_API_DATA.item_details,
    )
    mock_vouchervault_client.get_stats.return_value = updated_data

    await coordinator.async_refresh()
    await hass.async_block_till_done()

    assert coordinator.data.item_stats["total_items"] == 20
