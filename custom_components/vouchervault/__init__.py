"""The VoucherVault integration."""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.components.lovelace.const import (
    CONF_RESOURCE_TYPE_WS,
    DOMAIN as LOVELACE_DOMAIN,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_URL, Platform
from homeassistant.core import HomeAssistant, ServiceCall

from .config_flow import ConfigFlow
from .const import DOMAIN
from .coordinator import VoucherVaultCoordinator

_LOGGER = logging.getLogger(__name__)

_PLATFORMS: list[Platform] = [Platform.SENSOR]
_CARD_URL = "/vouchervault/vouchervault-card.js"
_CARD_UTILS_URL = "/vouchervault/vouchervault-card-utils.js"
_STATIC_PATH_REGISTERED = f"{DOMAIN}_static_path_registered"

type VoucherVaultConfigEntry = ConfigEntry[VoucherVaultCoordinator]


async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Migrate old config entries (delegates to ConfigFlow)."""
    flow = ConfigFlow()
    flow.hass = hass
    return await flow.async_migrate_entry(hass, entry)


def _get_lovelace_resource_collection(hass: HomeAssistant) -> object | None:
    """Return the Lovelace resource collection for both storage styles."""
    lovelace_data = hass.data.get(LOVELACE_DOMAIN)
    if isinstance(lovelace_data, dict):
        return lovelace_data.get("resources")
    return getattr(lovelace_data, "resources", None)


def _is_resource_registration_collection(resource_collection: object | None) -> bool:
    """Check if object supports Lovelace resource registration operations."""
    if resource_collection is None:
        return False

    return all(
        hasattr(resource_collection, attr)
        for attr in ("async_items", "async_create_item")
    )


def _is_resource_unregistration_collection(resource_collection: object | None) -> bool:
    """Check if object supports Lovelace resource unregistration operations."""
    return _is_resource_registration_collection(resource_collection) and hasattr(
        resource_collection, "async_delete_item"
    )


async def _async_register_lovelace_resource(hass: HomeAssistant, entry_id: str) -> None:
    """Register the Lovelace card JS module if not already present."""
    resource_collection = _get_lovelace_resource_collection(hass)
    if not _is_resource_registration_collection(resource_collection):
        _LOGGER.debug(
            "Lovelace is in YAML mode; skipping automatic card resource registration"
        )
        return

    # Ensure the collection is loaded before inspecting items when supported.
    if (
        hasattr(resource_collection, "loaded")
        and not resource_collection.loaded
        and hasattr(resource_collection, "async_get_info")
    ):
        await resource_collection.async_get_info()

    for item in resource_collection.async_items():
        if item.get(CONF_URL) == _CARD_URL:
            _LOGGER.debug("Lovelace card resource already registered")
            return

    item = await resource_collection.async_create_item(
        {CONF_RESOURCE_TYPE_WS: "module", CONF_URL: _CARD_URL}
    )
    hass.data.setdefault(DOMAIN, {})[entry_id] = item["id"]
    _LOGGER.debug("Registered Lovelace card resource: %s", _CARD_URL)


async def _async_unregister_lovelace_resource(
    hass: HomeAssistant, entry_id: str
) -> None:
    """Remove the Lovelace card resource that was registered on setup."""
    resource_id: str | None = hass.data.get(DOMAIN, {}).pop(entry_id, None)

    resource_collection = _get_lovelace_resource_collection(hass)
    if not _is_resource_unregistration_collection(resource_collection):
        return

    # If resource ID is not found, search for it by URL
    if resource_id is None:
        for item in resource_collection.async_items():
            if item.get(CONF_URL) == _CARD_URL:
                resource_id = item["id"]
                break

    if resource_id is None:
        return

    try:
        await resource_collection.async_delete_item(resource_id)
        _LOGGER.debug("Removed Lovelace card resource: %s", _CARD_URL)
    except Exception as err:  # noqa: BLE001
        _LOGGER.debug(
            "Could not remove Lovelace card resource %s: %s",
            resource_id,
            err,
            exc_info=True,
        )


async def async_setup_entry(
    hass: HomeAssistant, entry: VoucherVaultConfigEntry
) -> bool:
    """Set up VoucherVault from a config entry."""

    coordinator = VoucherVaultCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, _PLATFORMS)

    async def handle_toggle_item_status(call: ServiceCall) -> None:
        """Handle the service call to toggle item status."""
        item_id = call.data.get("item_id")
        if not item_id:
            _LOGGER.error("No item_id provided in service call")
            return
        await coordinator.client.toggle_item_status(item_id)

    hass.services.async_register(
        DOMAIN, "toggle_item_status", handle_toggle_item_status
    )

    if not hass.data.get(_STATIC_PATH_REGISTERED):
        frontend_dir = Path(__file__).parent / "frontend"
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    _CARD_URL,
                    str(frontend_dir / "vouchervault-card.js"),
                    cache_headers=False,
                ),
                StaticPathConfig(
                    _CARD_UTILS_URL,
                    str(frontend_dir / "vouchervault-card-utils.js"),
                    cache_headers=False,
                ),
            ]
        )
        hass.data[_STATIC_PATH_REGISTERED] = True

    await _async_register_lovelace_resource(hass, entry.entry_id)

    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: VoucherVaultConfigEntry
) -> bool:
    """Unload a config entry."""
    unloaded = await hass.config_entries.async_unload_platforms(entry, _PLATFORMS)
    if not unloaded:
        return False

    await _async_unregister_lovelace_resource(hass, entry.entry_id)
    hass.services.async_remove(DOMAIN, "toggle_item_status")
    return True
