"""Sensor platform for the VoucherVault integration."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from homeassistant.components.sensor import (
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import UpdateFailed

from .const import DOMAIN
from .coordinator import VoucherVaultCoordinator
from .vouchervault import ApiData


# a class to describe each sensor entity we want to create, including how to extract its value and attributes from the API data
@dataclass(frozen=True, kw_only=True)
class VoucherVaultSensorEntityDescription(SensorEntityDescription):
    """Describes a VoucherVault sensor entity."""

    value_fn: Callable[[ApiData], int | float | str | None]
    extra_attrs_fn: Callable[[ApiData], dict[str, Any]] = field(default=lambda _: {})


SENSOR_DESCRIPTIONS: tuple[VoucherVaultSensorEntityDescription, ...] = (
    # ------------------------------------------------------------------ #
    # 1. Items                                                             #
    # ------------------------------------------------------------------ #
    VoucherVaultSensorEntityDescription(
        key="items",
        translation_key="items",
        icon="mdi:ticket-outline",
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda data: data.item_stats.get("total_items"),
        extra_attrs_fn=lambda data: {
            "total_value": data.item_stats.get("total_value"),
            "vouchers": data.item_stats.get("vouchers"),
            "giftcards": data.item_stats.get("giftcards"),
            "coupons": data.item_stats.get("coupons"),
            "loyaltycards": data.item_stats.get("loyaltycards"),
            "used_items": data.item_stats.get("used_items"),
            "available_items": data.item_stats.get("available_items"),
            "expired_items": data.item_stats.get("expired_items"),
            "soon_expiring_items": data.item_stats.get("soon_expiring_items"),
        },
    ),
    # ------------------------------------------------------------------ #
    # 2. Users                                                             #
    # ------------------------------------------------------------------ #
    VoucherVaultSensorEntityDescription(
        key="users",
        translation_key="users",
        icon="mdi:account-group-outline",
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda data: data.user_stats.get("total_users"),
        extra_attrs_fn=lambda data: {
            "active_users": data.user_stats.get("active_users"),
            "disabled_users": data.user_stats.get("disabled_users"),
            "superusers": data.user_stats.get("superusers"),
            "staff_members": data.user_stats.get("staff_members"),
        },
    ),
    # ------------------------------------------------------------------ #
    # 3. Issuers                                                           #
    # ------------------------------------------------------------------ #
    VoucherVaultSensorEntityDescription(
        key="issuers",
        translation_key="issuers",
        icon="mdi:store-outline",
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda data: len(data.issuer_stats),
        extra_attrs_fn=lambda data: {
            "issuers": [
                {
                    "issuer": entry.get("issuer"),
                    "count": entry.get("count"),
                    "total_value": entry.get("total_value"),
                }
                for entry in data.issuer_stats
            ]
        },
    ),
    # ------------------------------------------------------------------ #
    # 4. Item Details                                                      #
    # ------------------------------------------------------------------ #
    VoucherVaultSensorEntityDescription(
        key="item_details",
        translation_key="item_details",
        icon="mdi:card-text-outline",
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda data: len(data.item_details),
        extra_attrs_fn=lambda data: {
            "items": [
                {
                    "id": item.get("id"),
                    "type": item.get("type"),
                    "name": item.get("name"),
                    "issuer": item.get("issuer"),
                    "value": item.get("value"),
                    "value_type": item.get("value_type"),
                    "issue_date": item.get("issue_date"),
                    "expiry_date": item.get("expiry_date"),
                    "description": item.get("description"),
                    "is_used": item.get("is_used"),
                    "user": item.get("user__username"),
                    # TODO: Redact sensitive values before production release.
                    "redeem_code": item.get("redeem_code"),
                    "code_type": item.get("code_type"),
                    "pin": item.get("pin"),
                }
                for item in data.item_details
            ]
        },
    ),
)


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    """Set up the VoucherVault sensor platform."""
    coordinator: VoucherVaultCoordinator = entry.runtime_data
    unique_id_prefix = f"{DOMAIN}_{entry.data['host']}_{entry.data['port']}"
    async_add_entities(
        VoucherVaultBaseSensor(coordinator, unique_id_prefix, description)
        for description in SENSOR_DESCRIPTIONS
    )


class VoucherVaultBaseSensor(SensorEntity):
    """Base class for VoucherVault sensors."""

    entity_description: VoucherVaultSensorEntityDescription

    def __init__(
        self,
        coordinator: VoucherVaultCoordinator,
        unique_id_prefix: str,
        entity_description: VoucherVaultSensorEntityDescription,
    ) -> None:
        """Initialize the sensor."""
        self.coordinator = coordinator
        self.entity_description = entity_description
        self._attr_unique_id = f"{unique_id_prefix}_{entity_description.key}"
        self._attr_available = False

    async def async_update(self) -> None:
        """Fetch updated state data from the coordinator."""
        try:
            await self.coordinator.async_request_refresh()
        except UpdateFailed:
            self._attr_available = False
            return

        if self.coordinator.data is None:
            self._attr_available = False
            return

        self._attr_available = True
        self._attr_native_value = self.entity_description.value_fn(
            self.coordinator.data
        )

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        """Return sensor attributes."""
        if self.coordinator.data is None:
            return None
        return self.entity_description.extra_attrs_fn(self.coordinator.data)
