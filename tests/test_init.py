"""Tests for VoucherVault integration setup and teardown."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant.components.lovelace.const import CONF_RESOURCE_TYPE_WS, DOMAIN as LOVELACE_DOMAIN
from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import CONF_URL
from homeassistant.core import HomeAssistant

from custom_components.vouchervault import (
    _async_register_lovelace_resource,
    _async_unregister_lovelace_resource,
    async_unload_entry,
)
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


def _reassert_lovelace_resources(
    hass: HomeAssistant, mock_lovelace_resources: AsyncMock
) -> None:
    """Re-point hass.data[LOVELACE_DOMAIN] at our mock after integration setup.

    Real lovelace setup (triggered by init_integration) may have replaced the
    dict this fixture originally seeded with its own LovelaceData dataclass
    instance, so re-apply the mock in whichever shape is currently present,
    matching the source's own _get_lovelace_resource_collection helper.
    """
    lovelace_data = hass.data.get(LOVELACE_DOMAIN)
    if isinstance(lovelace_data, dict):
        lovelace_data["resources"] = mock_lovelace_resources
    else:
        hass.data[LOVELACE_DOMAIN] = SimpleNamespace(resources=mock_lovelace_resources)


async def test_lovelace_resource_unregistered_on_unload(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    mock_lovelace_resources: AsyncMock,
) -> None:
    """Test Lovelace card resource is removed on unload."""
    _reassert_lovelace_resources(hass, mock_lovelace_resources)
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


async def test_lovelace_resource_registration_skipped_when_no_lovelace_data(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
) -> None:
    """Test resource registration is skipped when there is no Lovelace data at all."""
    hass.data.pop(LOVELACE_DOMAIN, None)

    await _async_register_lovelace_resource(hass, mock_config_entry.entry_id)

    assert DOMAIN not in hass.data or mock_config_entry.entry_id not in hass.data[DOMAIN]


@pytest.mark.usefixtures("mock_vouchervault_client")
async def test_lovelace_resource_registration_skipped_when_already_registered(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
    mock_lovelace_resources: AsyncMock,
) -> None:
    """Test registration is a no-op when the card resource already exists."""
    mock_lovelace_resources.async_items.return_value = [
        {CONF_URL: "/vouchervault/vouchervault-card.js", "id": "existing-id"}
    ]

    await _async_register_lovelace_resource(hass, mock_config_entry.entry_id)

    mock_lovelace_resources.async_create_item.assert_not_called()
    assert DOMAIN not in hass.data or mock_config_entry.entry_id not in hass.data[DOMAIN]


async def test_lovelace_resource_unregister_skipped_when_no_lovelace_data(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
) -> None:
    """Test unregistration is a no-op when there is no valid resource collection."""
    hass.data.pop(LOVELACE_DOMAIN, None)
    hass.data.setdefault(DOMAIN, {})[init_integration.entry_id] = "test-resource-id"

    # Should not raise even though there is nothing to unregister from.
    await _async_unregister_lovelace_resource(hass, init_integration.entry_id)


@pytest.mark.usefixtures("mock_vouchervault_client")
async def test_lovelace_resource_loaded_before_checking_items(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
    mock_lovelace_resources: AsyncMock,
) -> None:
    """Test the resource collection is loaded via async_get_info if not yet loaded."""
    mock_lovelace_resources.loaded = False

    await _async_register_lovelace_resource(hass, mock_config_entry.entry_id)

    mock_lovelace_resources.async_get_info.assert_called_once()
    mock_lovelace_resources.async_create_item.assert_called_once_with(
        {CONF_RESOURCE_TYPE_WS: "module", CONF_URL: "/vouchervault/vouchervault-card.js"}
    )


async def test_lovelace_resource_unregister_finds_by_url_when_id_missing(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    mock_lovelace_resources: AsyncMock,
) -> None:
    """Test unregistering falls back to searching by URL when no stored resource ID."""
    _reassert_lovelace_resources(hass, mock_lovelace_resources)
    mock_lovelace_resources.async_items.return_value = [
        {CONF_URL: "/vouchervault/vouchervault-card.js", "id": "found-by-url-id"}
    ]
    # No entry recorded under hass.data[DOMAIN], forcing the URL-search fallback.
    hass.data.setdefault(DOMAIN, {}).pop(init_integration.entry_id, None)

    await _async_unregister_lovelace_resource(hass, init_integration.entry_id)

    mock_lovelace_resources.async_delete_item.assert_called_once_with("found-by-url-id")


async def test_lovelace_resource_unregister_swallows_delete_errors(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
    mock_lovelace_resources: AsyncMock,
) -> None:
    """Test unregistering does not raise if deleting the resource fails."""
    _reassert_lovelace_resources(hass, mock_lovelace_resources)
    mock_lovelace_resources.async_delete_item.side_effect = RuntimeError("boom")
    hass.data.setdefault(DOMAIN, {})[init_integration.entry_id] = "test-resource-id"

    # Should not raise despite the delete failure.
    await _async_unregister_lovelace_resource(hass, init_integration.entry_id)

    mock_lovelace_resources.async_delete_item.assert_called_once_with("test-resource-id")


async def test_async_unload_entry_returns_false_when_platforms_fail_to_unload(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
) -> None:
    """Test async_unload_entry returns False without side effects if platform unload fails."""
    with patch.object(
        hass.config_entries, "async_unload_platforms", AsyncMock(return_value=False)
    ):
        result = await async_unload_entry(hass, init_integration)

    assert result is False
    # The service should remain registered since unload did not proceed.
    assert hass.services.has_service(DOMAIN, "toggle_item_status")
