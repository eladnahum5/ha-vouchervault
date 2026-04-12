<p align="center">
  <img src="custom_components/vouchervault/brand/icon.png" alt="VoucherVault logo" width="180">
</p>

# VoucherVault for Home Assistant

A Home Assistant integration for [VoucherVault](https://vouchervault.app) — track your vouchers, gift cards, and loyalty cards directly in Home Assistant.

## Requirements

- A running VoucherVault instance accessible from your Home Assistant host
- A VoucherVault user account (username and password)
- A VoucherVault API token (generated in your VoucherVault account settings)

## Installation

### HACS (recommended)

This repository is not yet in the default HACS store. Add it as a custom repository first:

1. Open HACS in Home Assistant
2. Click the three-dot menu (top right) → **Custom repositories**
3. Enter the repository URL and select category **Integration**
4. Click **Add**
5. Search for **VoucherVault** and install it
6. Restart Home Assistant

### Manual

Copy `custom_components/vouchervault` into your `config/custom_components/` directory and restart Home Assistant.

## Testing

**Python:** create a virtual environment, install [`requirements-test.txt`](requirements-test.txt), then run `pytest` from the repository root. The test suite uses [`pytest-homeassistant-custom-component`](https://github.com/MatthewFlamm/pytest-homeassistant-custom-component).

**Frontend (Lovelace card):** from the [`frontend/`](frontend/) directory, run `npm install` once, then `npm test` (Vitest + jsdom).

## Configuration

After installation, go to **Settings → Devices & Services → Add Integration** and search for **VoucherVault**. You will be prompted for:

| Field | Description |
|-------|-------------|
| `Host` | Hostname or IP of your VoucherVault instance (e.g. `192.168.1.100`) |
| `Port` | Port number (defaults to `8000`) |
| `Username` | Your VoucherVault username (defaults to `admin`) |
| `Password` | Your VoucherVault password |
| `API token` | API token from your VoucherVault account settings |
| `Polling interval (minutes)` | How often sensors refresh from the API (defaults to `30`, must be at least `1`; matches the interval suggested in the VoucherVault Home Assistant REST sensor docs) |

## Sensors

The integration creates four sensor entities. They share one update schedule, set by **Polling interval (minutes)** when you add the integration (default `30`, as recommended in the Home Assistant REST sensor section of the VoucherVault docs). Entries from older releases are migrated to version 2 with the default interval; to use a different interval, remove the integration and add it again with the desired value.

| Entity | State | Attributes |
|--------|-------|------------|
| `sensor.vouchervault_<host>_<port>_items` | Total item count | Item statistics |
| `sensor.vouchervault_<host>_<port>_users` | Total user count | User statistics |
| `sensor.vouchervault_<host>_<port>_issuers` | Total issuer count | Per-issuer statistics |
| `sensor.vouchervault_<host>_<port>_item_details` | Total item count | Full item details |

In entity IDs, dots in the host are replaced by underscores. For example, host `192.168.1.100` on port `8000` gives entity IDs like `sensor.vouchervault_192_168_1_100_8000_items`.

## Dashboard card

<img src="images/home_assistant_companion_app_screenshot.jfif" alt="VoucherVault card in the Home Assistant companion app" width="300">

This integration ships with a companion Lovelace card. When Lovelace is in **storage mode** (the default), the card resource is registered automatically when the integration is set up — no manual steps required.

When Lovelace is in **YAML mode**, automatic registration is skipped. Add the resource manually to your `configuration.yaml`:

```yaml
lovelace:
  mode: yaml
  resources:
    - url: /vouchervault/vouchervault-card.js
      type: module
```

Add the card to any dashboard using the card type `custom:vouchervault-card`.

> **Tip:** Because the card renders all your vouchers automatically, it can take up a lot of space. It is recommended to use it either as a [Bubble Card](https://github.com/Clooos/Bubble-Card) popup or on a dedicated dashboard rather than embedding it inline on your main dashboard.

### Card configuration

```yaml
type: custom:vouchervault-card
entity: sensor.vouchervault_192_168_1_100_8000_item_details
barcodePadding: 20
fields_to_show:
  - name
  - issuer
  - value
  - expiry_date
```

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | Yes | — | The `item_details` sensor entity ID |
| `barcodePadding` | No | `20` | Padding (in pixels) around rendered barcodes |
| `fields_to_show` | No | `["name", "issuer", "value", "expiry_date"]` | List of item fields to display on each voucher card |

### Barcode blur

Barcodes are blurred by default to prevent accidental exposure. **Tap or click any barcode to toggle the blur on and off.**

The blur resets when the card rebuilds its content (i.e. when the underlying sensor data changes).

### Card language

Fixed labels on the card (for example field names, buttons, and empty states) follow your Home Assistant user language. Bundled locales are **English**, **German**, **Spanish**, **French**, and **Hebrew** (`en`, `de`, `es`, `fr`, `he`). If your language is not translated yet, the card falls back to English.

## Services

### `vouchervault.toggle_item_status`

Toggle the active/inactive status of a voucher item.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `item_id` | Yes | The ID of the item to toggle |

## Roadmap

- [ ] Filter vouchers via card YAML (stage 1), then via UI (stage 2, may ship separately)
- [ ] Sort vouchers via card YAML (stage 1), then via UI (stage 2, may ship separately)
- [ ] Add support for reconfiguration of polling interval