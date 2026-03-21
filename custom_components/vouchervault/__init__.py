"""The VoucherVault integration."""

from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall, callback

from .const import DOMAIN
from .coordinator import VoucherVaultCoordinator

_LOGGER = logging.getLogger(__name__)

# For your initial PR, limit it to 1 platform.
_PLATFORMS: list[Platform] = [Platform.SENSOR]

type VoucherVaultConfigEntry = ConfigEntry[VoucherVaultCoordinator]


async def async_setup_entry(
    hass: HomeAssistant, entry: VoucherVaultConfigEntry
) -> bool:
    """Set up VoucherVault from a config entry."""

    # verification of credentials and connectivity is handled in the config flow,
    # so if we are here we can assume the API client will work.
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
        await coordinator.async_refresh()

    hass.services.async_register(
        DOMAIN, "toggle_item_status", handle_toggle_item_status
    )

    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: VoucherVaultConfigEntry
) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, _PLATFORMS)
