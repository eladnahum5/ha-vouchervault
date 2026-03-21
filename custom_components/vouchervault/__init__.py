"""The VoucherVault integration."""

from __future__ import annotations

from dataclasses import dataclass

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import ConfigEntryNotReady

from .coordinator import VoucherVaultCoordinator

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
    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: VoucherVaultConfigEntry
) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, _PLATFORMS)
