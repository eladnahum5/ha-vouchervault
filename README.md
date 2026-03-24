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

## Configuration

After installation, go to **Settings → Devices & Services → Add Integration** and search for **VoucherVault**. You will be prompted for:

| Field | Description |
|-------|-------------|
| `Host` | Hostname or IP of your VoucherVault instance (e.g. `192.168.1.100`) |
| `Port` | Port number (e.g. `8000`) |
| `Username` | Your VoucherVault username |
| `Password` | Your VoucherVault password |
| `API token` | API token from your VoucherVault account settings |

## Sensors

The integration creates four sensor entities, all updated every 30 minutes (as recommended in the Home Assistant REST sensor section of the VoucherVault docs):

| Entity | State | Attributes |
|--------|-------|------------|
| `sensor.vouchervault_<host>_<port>_items` | Total item count | Item statistics |
| `sensor.vouchervault_<host>_<port>_users` | Total user count | User statistics |
| `sensor.vouchervault_<host>_<port>_issuers` | Total issuer count | Per-issuer statistics |
| `sensor.vouchervault_<host>_<port>_item_details` | Total item count | Full item details |

In entity IDs, dots in the host are replaced by underscores. For example, host `192.168.1.100` on port `8000` gives entity IDs like `sensor.vouchervault_192_168_1_100_8000_items`.

## Dashboard card

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

## Services

### `vouchervault.toggle_item_status`

Toggle the active/inactive status of a voucher item.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `item_id` | Yes | The ID of the item to toggle |

## Roadmap

- [ ] Configurable polling interval
- [ ] Filter vouchers via card YAML (stage 1), then via UI (stage 2, may ship separately)
- [ ] Sort vouchers via card YAML (stage 1), then via UI (stage 2, may ship separately)
- [ ] Translations for popular languages
- [ ] Submit to the default HACS store
