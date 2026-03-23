"""Test the VoucherVault config flow."""

from unittest.mock import AsyncMock, patch

import pytest

from custom_components.vouchervault.config_flow import CannotConnect, InvalidAuth
from custom_components.vouchervault.const import DOMAIN

from homeassistant import config_entries
from homeassistant.const import (
    CONF_API_TOKEN,
    CONF_HOST,
    CONF_PASSWORD,
    CONF_PORT,
    CONF_USERNAME,
)
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType


pytestmark = pytest.mark.usefixtures("enable_custom_integrations")


async def test_form(hass: HomeAssistant, mock_setup_entry: AsyncMock) -> None:
    """Test we get the form."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {}

    with patch(
        "custom_components.vouchervault.config_flow.validate_input",
        return_value={"title": "1.1.1.1:8000"},
    ):
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            {
                CONF_HOST: "1.1.1.1",
                CONF_PORT: 8000,
                CONF_USERNAME: "test-username",
                CONF_PASSWORD: "test-password",
                CONF_API_TOKEN: "test-token",
            },
        )
        await hass.async_block_till_done()

    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "1.1.1.1:8000"
    assert result["data"] == {
        CONF_HOST: "1.1.1.1",
        CONF_PORT: 8000,
        CONF_USERNAME: "test-username",
        CONF_PASSWORD: "test-password",
        CONF_API_TOKEN: "test-token",
    }
    assert len(mock_setup_entry.mock_calls) == 1


async def test_form_invalid_auth(
    hass: HomeAssistant, mock_setup_entry: AsyncMock
) -> None:
    """Test we handle invalid auth."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )

    with patch(
        "custom_components.vouchervault.config_flow.validate_input",
        side_effect=InvalidAuth,
    ):
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            {
                CONF_HOST: "1.1.1.1",
                CONF_PORT: 8000,
                CONF_USERNAME: "test-username",
                CONF_PASSWORD: "test-password",
                CONF_API_TOKEN: "test-token",
            },
        )

    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base": "invalid_auth"}

    # Make sure the config flow tests finish with either an
    # FlowResultType.CREATE_ENTRY or FlowResultType.ABORT so
    # we can show the config flow is able to recover from an error.
    with patch(
        "custom_components.vouchervault.config_flow.validate_input",
        return_value={"title": "1.1.1.1:8000"},
    ):
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            {
                CONF_HOST: "1.1.1.1",
                CONF_PORT: 8000,
                CONF_USERNAME: "test-username",
                CONF_PASSWORD: "test-password",
                CONF_API_TOKEN: "test-token",
            },
        )
        await hass.async_block_till_done()

    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "1.1.1.1:8000"
    assert result["data"] == {
        CONF_HOST: "1.1.1.1",
        CONF_PORT: 8000,
        CONF_USERNAME: "test-username",
        CONF_PASSWORD: "test-password",
        CONF_API_TOKEN: "test-token",
    }
    assert len(mock_setup_entry.mock_calls) == 1


async def test_form_unknown_error(
    hass: HomeAssistant, mock_setup_entry: AsyncMock
) -> None:
    """Test we handle an unexpected exception."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )

    with patch(
        "custom_components.vouchervault.config_flow.validate_input",
        side_effect=Exception("Unexpected"),
    ):
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            {
                CONF_HOST: "1.1.1.1",
                CONF_PORT: 8000,
                CONF_USERNAME: "test-username",
                CONF_PASSWORD: "test-password",
                CONF_API_TOKEN: "test-token",
            },
        )

    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base": "unknown"}

    with patch(
        "custom_components.vouchervault.config_flow.validate_input",
        return_value={"title": "1.1.1.1:8000"},
    ):
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            {
                CONF_HOST: "1.1.1.1",
                CONF_PORT: 8000,
                CONF_USERNAME: "test-username",
                CONF_PASSWORD: "test-password",
                CONF_API_TOKEN: "test-token",
            },
        )
        await hass.async_block_till_done()

    assert result["type"] is FlowResultType.CREATE_ENTRY


async def test_form_cannot_connect(
    hass: HomeAssistant, mock_setup_entry: AsyncMock
) -> None:
    """Test we handle cannot connect error."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )

    with patch(
        "custom_components.vouchervault.config_flow.validate_input",
        side_effect=CannotConnect,
    ):
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            {
                CONF_HOST: "1.1.1.1",
                CONF_PORT: 8000,
                CONF_USERNAME: "test-username",
                CONF_PASSWORD: "test-password",
                CONF_API_TOKEN: "test-token",
            },
        )

    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base": "cannot_connect"}

    # Make sure the config flow tests finish with either an
    # FlowResultType.CREATE_ENTRY or FlowResultType.ABORT so
    # we can show the config flow is able to recover from an error.

    with patch(
        "custom_components.vouchervault.config_flow.validate_input",
        return_value={"title": "1.1.1.1:8000"},
    ):
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            {
                CONF_HOST: "1.1.1.1",
                CONF_PORT: 8000,
                CONF_USERNAME: "test-username",
                CONF_PASSWORD: "test-password",
                CONF_API_TOKEN: "test-token",
            },
        )
        await hass.async_block_till_done()

    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "1.1.1.1:8000"
    assert result["data"] == {
        CONF_HOST: "1.1.1.1",
        CONF_PORT: 8000,
        CONF_USERNAME: "test-username",
        CONF_PASSWORD: "test-password",
        CONF_API_TOKEN: "test-token",
    }
    assert len(mock_setup_entry.mock_calls) == 1
