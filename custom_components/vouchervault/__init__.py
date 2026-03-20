"""The VoucherVault integration."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import ConfigEntryNotReady

from .api import VoucherVaultApiClient

# For your initial PR, limit it to 1 platform.
_PLATFORMS: list[Platform] = [Platform.SENSOR]

type VoucherVaultConfigEntry = ConfigEntry[VoucherVaultApiClient]


async def async_setup_entry(
    hass: HomeAssistant, entry: VoucherVaultConfigEntry
) -> bool:
    """Set up VoucherVault from a config entry."""

    client = VoucherVaultApiClient(
        host=entry.data["host"],
        port=entry.data["port"],
        username=entry.data["username"],
        password=entry.data["password"],
        api_token=entry.data["api_token"],
    )

    # authenticate with the API to verify credentials are correct
    result = await client.test_connection()
    if not result:
        raise ConfigEntryNotReady(
            "Failed to authenticate with VoucherVault API with provided credentials"
        )

    # store the API client in the entry's runtime_data for platforms to access
    entry.runtime_data = client

    await hass.config_entries.async_forward_entry_setups(entry, _PLATFORMS)

    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: VoucherVaultConfigEntry
) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, _PLATFORMS)
