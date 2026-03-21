"""Tests for VoucherVault sensor platform."""

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant.core import HomeAssistant

pytestmark = pytest.mark.usefixtures("enable_custom_integrations")

# Entity IDs are derived from unique_id prefix (host_port) + description key.
_PREFIX = "sensor.vouchervault_192_168_1_100_8000"


async def test_sensor_items_state(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
) -> None:
    """Test items sensor reports correct state and attributes."""
    state = hass.states.get(f"{_PREFIX}_items")
    assert state is not None
    assert state.state == "10"

    attrs = state.attributes
    assert attrs["total_value"] == 250.0
    assert attrs["vouchers"] == 5
    assert attrs["giftcards"] == 3
    assert attrs["coupons"] == 2
    assert attrs["loyaltycards"] == 0
    assert attrs["used_items"] == 2
    assert attrs["available_items"] == 7
    assert attrs["expired_items"] == 1
    assert attrs["soon_expiring_items"] == 1


async def test_sensor_users_state(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
) -> None:
    """Test users sensor reports correct state and attributes."""
    state = hass.states.get(f"{_PREFIX}_users")
    assert state is not None
    assert state.state == "3"

    attrs = state.attributes
    assert attrs["active_users"] == 3
    assert attrs["disabled_users"] == 0
    assert attrs["superusers"] == 1
    assert attrs["staff_members"] == 1


async def test_sensor_issuers_state(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
) -> None:
    """Test issuers sensor reports correct count and per-issuer attributes."""
    state = hass.states.get(f"{_PREFIX}_issuers")
    assert state is not None
    assert state.state == "2"

    issuers = state.attributes["issuers"]
    assert len(issuers) == 2
    assert issuers[0]["issuer"] == "Store A"
    assert issuers[0]["count"] == 5
    assert issuers[0]["total_value"] == 150.0
    assert issuers[1]["issuer"] == "Store B"


async def test_sensor_item_details_state(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
) -> None:
    """Test item_details sensor reports count and full item attributes."""
    state = hass.states.get(f"{_PREFIX}_item_details")
    assert state is not None
    assert state.state == "1"

    items = state.attributes["items"]
    assert len(items) == 1
    item = items[0]
    assert item["id"] == "abc123"
    assert item["type"] == "voucher"
    assert item["name"] == "Test Voucher"
    assert item["issuer"] == "Store A"
    assert item["is_used"] is False
    assert item["redeem_code"] == "TESTCODE123"
    assert item["user"] == "testuser"


async def test_sensor_unavailable_when_no_data(
    hass: HomeAssistant,
    init_integration: MockConfigEntry,
) -> None:
    """Test all sensors return None state when coordinator has no data."""
    from custom_components.vouchervault.coordinator import VoucherVaultCoordinator

    coordinator: VoucherVaultCoordinator = init_integration.runtime_data
    coordinator.data = None

    # Trigger a state write for all entities
    coordinator.async_update_listeners()
    await hass.async_block_till_done()

    for key in ("items", "users", "issuers", "item_details"):
        state = hass.states.get(f"{_PREFIX}_{key}")
        assert state is not None
        assert state.state == "unknown", f"Expected unknown for {key}, got {state.state}"
