import {
    LitElement,
    html,
    css
} from "https://unpkg.com/lit-element@2.0.1/lit-element.js?module";

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

class VoucherRefreshButton extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            entity: { type: String }
        };
    }

    async _click() {
        await this.hass.callService("homeassistant", "update_entity", {
            entity_id: this.entity
        });
    }

    render() {
        return html`
            <button @click=${this._click}>Refresh Items</button>
        `;
    }

    static get styles() {
        return buttonStyle;
    }
}

class VoucherMarkUsedButton extends LitElement {
    static get properties() {
        return {
            item_id: { type: String },
            hass: { type: Object },
            entity: { type: String }
        };
    }

    async _click() {
        await this.hass.callService("vouchervault", "toggle_item_status", {
            item_id: this.item_id
        });
        // Refresh the entity so the card reflects the updated status immediately
        await this.hass.callService("homeassistant", "update_entity", {
            entity_id: this.entity
        });
    }

    render() {
        return html`
            <button @click=${this._click}>Mark as Used</button>
        `;
    }

    static get styles() {
        return buttonStyle;
    }
}

class VoucherVaultCard extends HTMLElement {
    setConfig(config) {
        if (!config.entity) {
            throw new Error("You need to define an entity");
        }

        this.config = {
            ...config,
            barcodePadding: config.barcodePadding ?? 20,
            fieldsToShow: config.fieldsToShow ?? ["name", "issuer", "value"]
        };

        // Inject bwip-js once for client-side barcode rendering
        if (!document.getElementById('bwip-js-script')) {
            const script = document.createElement('script');
            script.id = 'bwip-js-script';
            script.src = 'https://cdn.jsdelivr.net/npm/bwip-js/dist/bwip-js-min.js';
            document.head.appendChild(script);
        }
    }

    _renderBwipBarcodes() {
        const padding = this.config.barcodePadding;
        for (const canvas of this.content.querySelectorAll('canvas[data-bwip]')) {
            try {
                window.bwipjs.toCanvas(
                    canvas,
                    {
                        bcid: canvas.dataset.codeType,
                        text: canvas.dataset.code,
                        scale: 2,
                        includetext: true,
                        backgroundcolor: 'ffffff',
                        paddingwidth: padding,
                        paddingheight: padding,
                    });
                canvas.style.width = '100%';
                canvas.style.height = 'auto';
            } catch (e) {
                canvas.parentElement.insertAdjacentHTML(
                    'beforeend',
                    `<span style="color:red;font-size:0.8em">bwip-js: ${e.message}</span>`
                );
            }
        }
    }

    generateBarcodeHtml(code, codeType) {
        return `
            <canvas
                data-bwip
                data-code="${code}"
                data-code-type="${codeType}"
                style="filter: blur(5px); cursor: pointer; display: block;"
                onclick="this.style.filter = this.style.filter === 'blur(5px)' ? 'none' : 'blur(5px)'"
            ></canvas>
        `;
    }

    generateItemHtml(item, entityId) {
        // loop through fieldsToShow and only include those in the output
        let fieldsHtml = '';
        for (const field of this.config.fieldsToShow) {
            if (item[field]) {
                // Capitalize the all first letters of the field name for display and replace underscores with spaces
                const displayField = field.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                fieldsHtml += `${displayField}: ${item[field]}<br>`;
            }
            else {
                // raise error in UI if field is not found in item
                fieldsHtml += `<span style="color:red;font-size:0.8em">Field not found: ${field}</span><br>`;
            }
        }
        return `
                <div class="voucher-item">
                    ${fieldsHtml}
                    <mark-as-used-button item_id="${item.id}" entity="${entityId}"></mark-as-used-button><br><br>
                    ${this.generateBarcodeHtml(item.redeem_code, item.code_type)}<br>
                </div>
            `;
    }

    // Called by Home Assistant each time the state changes
    set hass(hass) {
        // Initialize card structure on first render
        if (!this.content) {
            this.innerHTML = `
                <ha-card header="Voucher Vault">
                    <div class="card-content">
                        <p>Loading...</p>
                    </div>
                </ha-card>
            `;
            this.content = this.querySelector('.card-content');
        }

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

        // Only rebuild the DOM when items data actually changes, so user-toggled
        // blur states are not reset on every HA state update (which fires frequently
        // on mobile and would otherwise reset the blur within seconds).
        const itemsJson = JSON.stringify(itemDetails);
        if (this._lastItemsJson !== itemsJson) {
            this._lastItemsJson = itemsJson;

            const separatorHtml = `<div class="separator"><br><hr></div>`;
            let vouchersHtml = `
                <voucher-refresh-button entity="${entityId}">Test</voucher-refresh-button>
                ${separatorHtml}
            `;
            for (const item of itemDetails) {
                if (item.is_used) {
                    continue; // Skip already-used vouchers
                }
                vouchersHtml += `
                    ${this.generateItemHtml(item, entityId)}
                    ${separatorHtml}
                `;
            }

            this.content.innerHTML = vouchersHtml;

            // Render barcodes, or defer until bwip-js finishes loading
            if (window.bwipjs) {
                this._renderBwipBarcodes();
            } else {
                const script = document.getElementById('bwip-js-script');
                if (script) script.addEventListener('load', () => this._renderBwipBarcodes(), { once: true });
            }
        }

        // Pass the hass object to LitElement sub-components so they can call services
        const refreshButton = this.content.querySelector("voucher-refresh-button");
        if (refreshButton) {
            refreshButton.hass = hass;
        }
        for (const button of this.content.querySelectorAll("mark-as-used-button")) {
            button.hass = hass;
        }
    }
}

customElements.define('vouchervault-card', VoucherVaultCard);
customElements.define("mark-as-used-button", VoucherMarkUsedButton);
customElements.define("voucher-refresh-button", VoucherRefreshButton);
