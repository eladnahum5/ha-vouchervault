"""Tests for real validate_input and config entry migration."""

from unittest.mock import AsyncMock, patch

import aiohttp
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.vouchervault.config_flow import (
    ConfigFlow,
    CannotConnect,
    InvalidAuth,
    InvalidPollingInterval,
    validate_input,
)
from custom_components.vouchervault.const import (
    DOMAIN,
    POLLING_INTERVAL_MINUTES_KEY,
    UPDATE_INTERVAL_MINUTES_DEFAULT,
)

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


def _user_input(**overrides: object) -> dict:
    """Build user input for the config flow step."""
    data = {
        CONF_HOST: "1.1.1.1",
        CONF_PORT: 8000,
        CONF_USERNAME: "test-username",
        CONF_PASSWORD: "test-password",
        CONF_API_TOKEN: "test-token",
        POLLING_INTERVAL_MINUTES_KEY: UPDATE_INTERVAL_MINUTES_DEFAULT,
    }
    data.update(overrides)
    return data


async def test_validate_input_rejects_zero_polling(hass: HomeAssistant) -> None:
    """Polling interval below 1 raises InvalidPollingInterval."""
    with pytest.raises(InvalidPollingInterval):
        await validate_input(hass, _user_input(**{POLLING_INTERVAL_MINUTES_KEY: 0}))


async def test_form_invalid_polling_interval(
    hass: HomeAssistant, mock_setup_entry: AsyncMock
) -> None:
    """Flow surfaces invalid_polling_interval when validate_input raises."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        _user_input(**{POLLING_INTERVAL_MINUTES_KEY: 0}),
    )
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base": "invalid_polling_interval"}


async def test_form_cannot_connect_real_validate(
    hass: HomeAssistant, mock_setup_entry: AsyncMock
) -> None:
    """ClientError from test_connection maps to cannot_connect."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    with patch(
        "custom_components.vouchervault.config_flow.VoucherVaultApiClient"
    ) as mock_cls:
        mock_client = AsyncMock()
        mock_client.test_connection.side_effect = aiohttp.ClientConnectionError(
            "network down"
        )
        mock_cls.return_value = mock_client
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            _user_input(),
        )
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base": "cannot_connect"}


async def test_form_invalid_auth_real_validate(
    hass: HomeAssistant, mock_setup_entry: AsyncMock
) -> None:
    """False from test_connection maps to invalid_auth."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    with patch(
        "custom_components.vouchervault.config_flow.VoucherVaultApiClient"
    ) as mock_cls:
        mock_client = AsyncMock()
        mock_client.test_connection.return_value = False
        mock_cls.return_value = mock_client
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            _user_input(),
        )
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base": "invalid_auth"}


async def test_form_create_entry_real_validate(
    hass: HomeAssistant, mock_setup_entry: AsyncMock
) -> None:
    """Successful validate_input creates an entry with full data."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    user_input = _user_input()
    with patch(
        "custom_components.vouchervault.config_flow.VoucherVaultApiClient"
    ) as mock_cls:
        mock_client = AsyncMock()
        mock_client.test_connection.return_value = True
        mock_cls.return_value = mock_client
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            user_input,
        )
        await hass.async_block_till_done()

    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "1.1.1.1:8000"
    assert result["data"] == user_input
    mock_cls.assert_called_once()
    mock_client.test_connection.assert_awaited_once()
    assert len(mock_setup_entry.mock_calls) == 1


async def test_async_migrate_entry_v1_adds_polling(hass: HomeAssistant) -> None:
    """Version 1 entries gain polling_interval_minutes and move to version 2."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        version=1,
        title="1.1.1.1:8000",
        data={
            CONF_HOST: "1.1.1.1",
            CONF_PORT: 8000,
            CONF_USERNAME: "u",
            CONF_PASSWORD: "p",
            CONF_API_TOKEN: "t",
        },
    )
    entry.add_to_hass(hass)
    flow = ConfigFlow()
    flow.hass = hass

    assert await flow.async_migrate_entry(hass, entry) is True
    assert entry.version == 2
    assert entry.data[POLLING_INTERVAL_MINUTES_KEY] == UPDATE_INTERVAL_MINUTES_DEFAULT
    assert entry.data[CONF_HOST] == "1.1.1.1"


async def test_async_migrate_entry_future_version_returns_false(
    hass: HomeAssistant,
) -> None:
    """Entries newer than this flow's version return False."""
    entry = MockConfigEntry(domain=DOMAIN, version=99, data=_user_input())
    entry.add_to_hass(hass)
    flow = ConfigFlow()
    flow.hass = hass

    assert await flow.async_migrate_entry(hass, entry) is False
