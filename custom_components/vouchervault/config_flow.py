"""Config flow for the VoucherVault integration."""

from __future__ import annotations

import logging
from typing import Any

import aiohttp
import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.const import (
    CONF_API_TOKEN,
    CONF_HOST,
    CONF_PASSWORD,
    CONF_PORT,
    CONF_USERNAME,
)
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

from .const import DOMAIN
from .vouchervault import VoucherVaultApiClient

_LOGGER = logging.getLogger(__name__)

STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        # TODO: defaults for debugging, MUST be removed in production
        vol.Required(CONF_HOST, default="192.168.0.122"): str,
        vol.Required(CONF_PORT, default=8000): int,
        vol.Required(CONF_USERNAME, default="admin"): str,
        vol.Required(CONF_PASSWORD, default=r"guTap%8910Fb3&"): str,
        vol.Required(
            CONF_API_TOKEN, default="c923cc92-0173-4663-a277-58b87f4860a3"
        ): str,
    }
)


async def validate_input(hass: HomeAssistant, data: dict[str, Any]) -> dict[str, Any]:
    """Validate the user input allows us to connect.

    Data has the keys from STEP_USER_DATA_SCHEMA with values provided by the user.
    """
    client = VoucherVaultApiClient(
        host=data[CONF_HOST],
        port=data[CONF_PORT],
        username=data[CONF_USERNAME],
        password=data[CONF_PASSWORD],
        api_token=data[CONF_API_TOKEN],
    )
    _LOGGER.info(
        "Attempting to authenticate with VoucherVault API at %s:%s",
        data[CONF_HOST],
        data[CONF_PORT],
    )
    try:
        authenticated = await client.test_connection()
    except aiohttp.ClientError as err:
        raise CannotConnect from err

    if not authenticated:
        _LOGGER.error("Failed to authenticate with provided credentials")
        _LOGGER.debug(
            "Authentication result: %s",
            authenticated,
        )
        raise InvalidAuth

    _LOGGER.info("Authentication successful with provided credentials")

    return {"title": f"{data[CONF_HOST]}:{data[CONF_PORT]}"}


class ConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for VoucherVault."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step."""
        errors: dict[str, str] = {}
        if user_input is not None:
            try:
                info = await validate_input(self.hass, user_input)
            except CannotConnect:
                errors["base"] = "cannot_connect"
            except InvalidAuth:
                errors["base"] = "invalid_auth"
            except Exception:
                _LOGGER.exception("Unexpected exception")
                errors["base"] = "unknown"
            else:
                return self.async_create_entry(title=info["title"], data=user_input)

        return self.async_show_form(
            step_id="user", data_schema=STEP_USER_DATA_SCHEMA, errors=errors
        )


class CannotConnect(HomeAssistantError):
    """Error to indicate we cannot connect."""


class InvalidAuth(HomeAssistantError):
    """Error to indicate there is invalid auth."""
