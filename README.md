# VoucherVault for Home Assistant

> [!WARNING]
> **This integration is not ready for use.** It is under active development and should be considered pre-alpha. Features are incomplete, APIs may change without notice, and it has not been tested for production use. **Do not install this on a production Home Assistant instance.**

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

The integration creates four sensor entities, all updated every 2 minutes:

| Entity | State | Attributes |
|--------|-------|------------|
| `sensor.vouchervault_<host>_<port>_items` | Total item count | Item statistics |
| `sensor.vouchervault_<host>_<port>_users` | Total user count | User statistics |
| `sensor.vouchervault_<host>_<port>_issuers` | Total issuer count | Per-issuer statistics |
| `sensor.vouchervault_<host>_<port>_item_details` | Total item count | Full item details |

In entity IDs, dots in the host are replaced by underscores. For example, host `192.168.1.100` on port `8000` gives entity IDs like `sensor.vouchervault_192_168_1_100_8000_items`.

## Dashboard card

This integration ships with a companion Lovelace card. After installation, add it as a resource once:

1. Go to **Settings → Dashboards → Resources** (three-dot menu, top right)
2. Click **Add resource**
3. Enter URL: `/vouchervault/vouchervault-card.js`
4. Select type: **JavaScript module**
5. Click **Create**

Then add the card to any dashboard using the card type `custom:vouchervault-card`.

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

- [ ] Auto-register the Lovelace card resource on setup (no manual resource step)
- [ ] Configurable polling interval
- [ ] Translations for popular languages
- [ ] Submit to the default HACS store
