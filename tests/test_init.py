"""Tests for VoucherVault integration setup and teardown."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant.components.lovelace.const import CONF_RESOURCE_TYPE_WS, DOMAIN as LOVELACE_DOMAIN
from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import CONF_URL
from homeassistant.core import HomeAssistant

from custom_components.vouchervault import _async_register_lovelace_resource
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


@pytest.mark.usefixtures("mock_vouchervault_client")
async def test_lovelace_resource_registered_on_setup(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
) -> None:
    """Test Lovelace card resource is registered on setup."""
    with patch(
        "custom_components.vouchervault._async_register_lovelace_resource",
        new=AsyncMock(),
    ) as mock_register_resource:
        mock_config_entry.add_to_hass(hass)
        await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()

    mock_register_resource.assert_called_once_with(hass, mock_config_entry.entry_id)


@pytest.mark.usefixtures("mock_vouchervault_client")
async def test_lovelace_resource_not_duplicated(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
    mock_lovelace_resources: AsyncMock,
) -> None:
    """Test Lovelace card resource is not re-registered if already present."""
    mock_lovelace_resources.async_items.return_value = [
        {CONF_URL: "/vouchervault/vouchervault-card.js"}
    ]

    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    mock_lovelace_resources.async_create_item.assert_not_called()


@pytest.mark.usefixtures("mock_vouchervault_client")
async def test_lovelace_resource_skipped_in_yaml_mode(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
) -> None:
    """Test Lovelace resource registration is skipped when in YAML mode."""
    mock_yaml_resources = MagicMock()  # Not a ResourceStorageCollection instance
    hass.data[LOVELACE_DOMAIN]["resources"] = mock_yaml_resources

    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    mock_yaml_resources.async_create_item.assert_not_called()


async def test_lovelace_resource_unregistered_on_unload(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    mock_lovelace_resources: AsyncMock,
) -> None:
    """Test Lovelace card resource is removed on unload."""
    hass.data.setdefault(LOVELACE_DOMAIN, {})["resources"] = mock_lovelace_resources
    hass.data.setdefault(DOMAIN, {})[init_integration.entry_id] = "test-resource-id"

    await hass.config_entries.async_unload(init_integration.entry_id)
    await hass.async_block_till_done()

    mock_lovelace_resources.async_delete_item.assert_called_once_with("test-resource-id")


@pytest.mark.usefixtures("mock_vouchervault_client")
async def test_lovelace_resource_registered_with_lovelace_data_object(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
    mock_lovelace_resources: AsyncMock,
) -> None:
    """Test Lovelace resource registration works with object-style Lovelace data."""

    class MockLovelaceData:
        def __init__(self, resources: AsyncMock) -> None:
            self.resources = resources

    hass.data[LOVELACE_DOMAIN] = MockLovelaceData(mock_lovelace_resources)

    await _async_register_lovelace_resource(hass, mock_config_entry.entry_id)

    mock_lovelace_resources.async_create_item.assert_called_once_with(
        {CONF_RESOURCE_TYPE_WS: "module", CONF_URL: "/vouchervault/vouchervault-card.js"}
    )
