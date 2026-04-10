"""Coordinator for VoucherVault integration."""

from __future__ import annotations

import asyncio
from datetime import timedelta
import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DOMAIN, UPDATE_INTERVAL_MINUTES
from .vouchervault import ApiData, VoucherVaultApiClient

_LOGGER = logging.getLogger(__name__)


class VoucherVaultCoordinator(DataUpdateCoordinator[ApiData]):
    """Coordinator to manage fetching data from the VoucherVault API."""

    def __init__(self, hass: HomeAssistant, config_entry: ConfigEntry) -> None:
        """Initialize the coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            config_entry=config_entry,
            update_interval=timedelta(minutes=config_entry.data["polling_interval"]),
        )

        self.client = VoucherVaultApiClient(
            host=config_entry.data["host"],
            port=config_entry.data["port"],
            username=config_entry.data["username"],
            password=config_entry.data["password"],
            api_token=config_entry.data["api_token"],
        )

    async def _async_update_data(self) -> ApiData:
        """Fetch data from the VoucherVault API."""
        try:
            async with asyncio.timeout(10):
                return await self.client.get_stats()
        except TimeoutError as e:
            raise UpdateFailed(
                f"Timeout fetching data from VoucherVault API: {e}"
            ) from e
        except UpdateFailed as e:
            raise UpdateFailed(f"Error fetching data from VoucherVault API: {e}") from e
