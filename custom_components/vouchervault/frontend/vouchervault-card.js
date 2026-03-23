import {
    LitElement,
    html,
    css
} from "https://unpkg.com/lit-element@2.0.1/lit-element.js?module";

// Escape special HTML characters to prevent broken markup or XSS when
// inserting untrusted strings into innerHTML.
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

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
        // Arrow function ensures `this` refers to the LitElement instance, not
        // the native button element that fired the event.
        return html`
            <button @click=${() => this._click()}>Refresh Items</button>
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
            <button @click=${() => this._click()}>Mark as Used</button>
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
            barcode_padding: config.barcode_padding ?? 10,
            fields_to_show: config.fields_to_show ?? ["name", "issuer", "value", "expiry_date"]
        };

        // Inject bwip-js once for client-side barcode rendering
        if (!document.getElementById('bwip-js-script')) {
            const script = document.createElement('script');
            script.id = 'bwip-js-script';
            script.src = 'https://cdn.jsdelivr.net/npm/bwip-js/dist/bwip-js-min.js';
            document.head.appendChild(script);
        }
    }

    // HA calls this before the card renders to reserve space in the grid
    // (prevents layout jumping). The value is in grid rows (~50px each) and
    // is just a hint — it cannot be dynamic based on actual content, so 3 is
    // a reasonable default for a medium-sized card.
    getCardSize() {
        return 3;
    }

    _renderBwipBarcodes() {
        const padding = this.config.barcode_padding;
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
                    `<span style="color:red;font-size:0.8em">bwip-js: ${escHtml(e.message)}</span>`
                );
            }
        }
    }

    generateBarcodeHtml(code, codeType) {
        // HA's Content Security Policy blocks inline onclick handlers, so the
        // blur toggle is handled via event delegation added during initialisation.
        return `
            <canvas
                data-bwip
                data-code="${escHtml(code)}"
                data-code-type="${escHtml(codeType)}"
                style="filter: blur(5px); cursor: pointer; display: block;"
            ></canvas>
        `;
    }

    generateItemHtml(item, entityId) {
        // Loop through fields_to_show and only include those in the output
        let fieldsHtml = '';
        for (const field of this.config.fields_to_show) {
            if (item[field]) {
                // Capitalise each word and replace underscores with spaces for display
                const displayField = field.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                fieldsHtml += `${escHtml(displayField)}: ${escHtml(item[field])}<br>`;
            } else {
                // Warn in the UI if a configured field is absent from the item data
                fieldsHtml += `<span style="color:red;font-size:0.8em">Field not found: ${escHtml(field)}</span><br>`;
            }
        }
        return `
                <div class="voucher-item">
                    ${fieldsHtml}
                    <mark-as-used-button item_id="${escHtml(item.id)}" entity="${escHtml(entityId)}"></mark-as-used-button><br><br>
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

            // Delegate canvas clicks here once so the listener survives innerHTML
            // replacements. HA's CSP blocks inline onclick attributes.
            this.content.addEventListener('click', (e) => {
                if (e.target.matches('canvas[data-bwip]')) {
                    const c = e.target;
                    c.style.filter = c.style.filter === 'blur(5px)' ? 'none' : 'blur(5px)';
                }
            });
        }

        const entityId = this.config.entity;
        const state = hass.states[entityId];
        if (!state) {
            this.content.innerHTML = `<p>Entity not found: ${escHtml(entityId)}</p>`;
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
                <voucher-refresh-button entity="${escHtml(entityId)}">Test</voucher-refresh-button>
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

// Register the card so it appears in the HA dashboard card picker UI.
window.customCards = window.customCards || [];
window.customCards.push({
    type: 'vouchervault-card',
    name: 'VoucherVault Card',
    description: 'Display and manage vouchers from VoucherVault'
});
