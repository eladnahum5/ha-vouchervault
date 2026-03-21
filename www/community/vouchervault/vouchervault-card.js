import {
    LitElement,
    html,
    css
} from "https://unpkg.com/lit-element@2.0.1/lit-element.js?module";

// Define a reusable CSS style for buttons
const buttonStyle = css`
    button {
        padding: 10px 16px;
        border-radius: 10px;
        border: none;
        background: #6b6b6b;
        color: white;
        cursor: pointer;
    }
`;

// Define a custom element for the refresh button using LitElement
class VoucherRefreshButton extends LitElement {
    // Define the properties for the refresh button
    static get properties() {
        return {
            hass: { type: Object },
            entity: { type: String }  // replaces hardcoded entity ID
        };
    }

    // Handle the click event to refresh the voucher items
    async _click() {
        await this.hass.callService("homeassistant", "update_entity", {
            entity_id: this.entity
        });
    }

    // Render the refresh button
    render() {
        return html`
            <button @click=${this._click}>Refresh Items</button>
        `;
    }

    // Define styles for the refresh button
    static get styles() {
        return buttonStyle;
    }
}

// Define a custom element for the "Mark as Used" button
class VoucherMarkUsedButton extends LitElement {
    // Define the properties for the "Mark as Used" button
    static get properties() {
        return {
            item_id: { type: String },
            hass: { type: Object },
            entity: { type: String }
        };
    }

    // Handle the click event to mark the voucher as used and refresh the item list
    async _click() {
        // TODO: replace with vouchervault.toggle_item_status once implemented in the integration
        await this.hass.callService("vouchervault", "toggle_item_status", {
            item_id: this.item_id
        });
        await this.hass.callService("homeassistant", "update_entity", {
            entity_id: this.entity
        });
    }

    // Render the "Mark as Used" button
    render() {
        return html`
            <button @click=${this._click}>Mark as Used</button>
        `;
    }

    // Define styles for the "Mark as Used" button
    static get styles() {
        return buttonStyle;
    }
}

class VoucherVaultCard extends HTMLElement {
    setConfig(config) {
        // Validate that the required configuration options are provided
        if (!config.entity) {
            throw new Error("You need to define an entity");
        }


        // Store the configuration and set default values for optional parameters
        this.config = {
            ...config,
            quietZone: config.quietZone || 10, // Default quiet zone for barcode images
            qunit: config.qunit || 'Pixel' // Default qunit for barcode images
        };
    }

    _generateRedeemLink(redeem_code, code_type) {
        // Generate a link to the barcode image using the Tec-IT Barcode Generator API
        const baseUrl = 'https://barcode.tec-it.com/barcode.ashx';
        const quietZone = this.config.quietZone;
        const qunit = this.config.qunit;
        return `${baseUrl}?data=${redeem_code}&code=${code_type}&quietzone=${quietZone}&qunit=${qunit}`;
    }

    _toggleImageBlur(imgElement) {
        // Toggle the blur effect on the image when clicked
        if (imgElement.style.filter === 'blur(5px)') {
            imgElement.style.filter = 'none';
        } else {
            imgElement.style.filter = 'blur(5px)';
        }
    }

    // Called when the card is added to the DOM
    set hass(hass) {
        // If the card content hasn't been initialized yet, create the basic structure
        if (!this.content) {
            this.innerHTML = `
                <ha-card header="Voucher Vault">
                    <div class="card-content">
                        <p>Loading...</p>
                    </div>
                </ha-card>
            `;
            this.content = this.querySelector('.card-content'); // Cache the content element for later updates
        }

        // Get the entity ID from the configuration and retrieve the item details from the Home Assistant state
        const entityId = this.config.entity;
        const state = hass.states[entityId];
        if (!state) {
            this.content.innerHTML = `<p>Entity not found: ${entityId}</p>`;
            return;
        }
        const itemDetails = state.attributes.items;
        if (!itemDetails) {
            this.content.innerHTML = `<p>No items data yet.</p>`;
            return;
        }

        // Loop over the item details and create a list of vouchers
        const seperatorHtml = `<div class="separator"><br><hr></div>`;
        let vouchersHtml = `
            <voucher-refresh-button entity="${entityId}">Test</voucher-refresh-button>
            ${seperatorHtml}
        `;
        for (const item of itemDetails) {
            if (item.is_used) {
                continue; // Skip used vouchers
            }
            const link_to_redeem = this._generateRedeemLink(item.redeem_code, item.code_type);
            vouchersHtml += `
                <div class="voucher-item">
                    Name: ${item.name}<br>
                    Issuer: ${item.issuer}<br>
                    Value: ${item.value}<br>
                    <mark-as-used-button item_id="${item.id}" entity="${entityId}"></mark-as-used-button><br><br>
                    <img
                        src="${link_to_redeem}"
                        alt="Voucher Image"
                        style="filter: blur(5px); cursor: pointer;"
                        onclick="this._toggleImageBlur ? this._toggleImageBlur(this) : (this.style.filter = this.style.filter === 'blur(5px)' ? 'none' : 'blur(5px)')"
                    ><br>
                </div>
                ${seperatorHtml}
            `;
        }

        // Update the card content with the list of vouchers
        this.content.innerHTML = vouchersHtml;
        const refreshButton = this.content.querySelector("voucher-refresh-button");
        if (refreshButton) {
            refreshButton.hass = hass;
        }
        for (const button of this.content.querySelectorAll("mark-as-used-button")) {
            button.hass = hass;
        }
    }
}

// Define the custom element so it can be used in Home Assistant Lovelace UI
customElements.define('vouchervault-card', VoucherVaultCard);
customElements.define("mark-as-used-button", VoucherMarkUsedButton);
customElements.define("voucher-refresh-button", VoucherRefreshButton);