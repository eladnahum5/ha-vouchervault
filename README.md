# VoucherVault for Home Assistant

> [!WARNING]
> **This integration is not ready for use.** It is under active development and should be considered pre-alpha. Features are incomplete, APIs may change without notice, and it has not been tested for production use. **Do not install this on a production Home Assistant instance.**

A Home Assistant integration for [VoucherVault](https://vouchervault.app) — track your vouchers, gift cards, and loyalty cards directly in Home Assistant.

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

After installation, go to **Settings → Devices & Services → Add Integration** and search for **VoucherVault**. Enter your VoucherVault API URL and API key.

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
entity: sensor.vouchervault_192_168_1_100_8000_item_details  # replace with your entity ID
barcodePadding: 20                                           # optional, default: 20
```

The entity ID follows the pattern `sensor.vouchervault_<host>_<port>_item_details`, where `<host>` has dots replaced by underscores. For example, if your VoucherVault instance runs at `192.168.1.100:8000`, the entity ID is `sensor.vouchervault_192_168_1_100_8000_item_details`. You can find the exact ID in **Settings → Devices & Services → VoucherVault → Entities**.

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `entity` | Yes | — | The `item_details` sensor entity ID (see pattern above) |
| `barcodePadding` | No | `20` | Padding (in pixels) around rendered barcodes |

## Services

### `vouchervault.toggle_item_status`

Toggle the active/inactive status of a voucher item.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `item_id` | Yes | The ID of the item to toggle |
