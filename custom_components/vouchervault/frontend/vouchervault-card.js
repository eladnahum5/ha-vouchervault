import {
    LitElement,
    html,
    css
} from "https://unpkg.com/lit-element@2.0.1/lit-element.js?module";

import {
    escHtml,
    vvTranslateCard,
    vvFieldLabel,
} from "/vouchervault/vouchervault-card-utils.js";

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
        const label = this.hass
            ? vvTranslateCard(this.hass, 'refresh_items', 'Refresh items')
            : 'Refresh items';
        // Arrow function ensures `this` refers to the LitElement instance, not
        // the native button element that fired the event.
        return html`
            <button @click=${() => this._click()}>${label}</button>
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
        const label = this.hass
            ? vvTranslateCard(this.hass, 'mark_as_used', 'Mark as used')
            : 'Mark as used';
        return html`
            <button @click=${() => this._click()}>${label}</button>
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

    _updateCardChrome(hass) {
        const haCard = this.querySelector('ha-card');
        if (haCard) {
            const title = vvTranslateCard(hass, 'title', 'VoucherVault');
            haCard.setAttribute('header', title);
        }
        if (this.content) {
            const loading = this.content.querySelector('.vv-card-loading');
            if (loading) {
                loading.textContent = vvTranslateCard(hass, 'loading', 'Loading...');
            }
        }
    }

    _renderBwipBarcodes() {
        const padding = this.config.barcode_padding;
        const hass = this._hass;
        const errPrefix = hass
            ? vvTranslateCard(hass, 'barcode_error_prefix', 'Barcode error')
            : 'Barcode error';
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
                // Adjust canvas size to fit the card width while maintaining aspect ratio.
                // Some code types (e.g. QR) are more square, so only set width to 50% for those.
                if (['qrcode', 'datamatrix', 'azteccode'].includes(canvas.dataset.codeType)) {
                    canvas.style.width = '50%';
                } else {
                    canvas.style.width = '100%';
                }
                canvas.style.height = 'auto';
            } catch (e) {
                canvas.parentElement.insertAdjacentHTML(
                    'beforeend',
                    `<span style="color:red;font-size:0.8em">${escHtml(errPrefix)}: ${escHtml(e.message)}</span>`
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

    generateItemHtml(hass, item, entityId) {
        // Loop through fields_to_show and only include those in the output
        let fieldsHtml = '';
        for (const field of this.config.fields_to_show) {
            if (item[field]) {
                const displayField = vvFieldLabel(hass, field);
                fieldsHtml += `${escHtml(displayField)}: ${escHtml(item[field])}<br>`;
            } else {
                const prefix = vvTranslateCard(hass, 'field_not_found', 'Field not found');
                fieldsHtml += `<span style="color:red;font-size:0.8em">${escHtml(prefix)}: ${escHtml(field)}</span><br>`;
            }
        }
        return `
                <div class="voucher-item">
                    ${fieldsHtml}
                    <mark-as-used-button item_id="${escHtml(item.id)}" entity="${escHtml(entityId)}"></mark-as-used-button><br><br>
                    ${this.generateBarcodeHtml(item.redeem_code, item.code_type)}
                </div>
            `;
    }

    /**
     * Merge `config_panel` strings (under vouchervault_lovelace) into hass.resources.
     * HA does not preload this category for our domain until requested, so
     * hass.localize would otherwise fall back to English.
     */
    async _vvLoadCardCategoryIfNeeded(hass) {
        const lang = hass.language || 'en';
        if (typeof hass.loadBackendTranslation !== 'function') {
            return;
        }
        if (this._vvCardCategoryLoadedForLang === lang) {
            return;
        }
        if (!this._vvInflightCardLoads) {
            this._vvInflightCardLoads = {};
        }
        if (this._vvInflightCardLoads[lang]) {
            await this._vvInflightCardLoads[lang];
            if (this._hass === hass && (hass.language || 'en') === lang) {
                this._lastRenderCacheKey = null;
                this._vvApplyHassContent(hass);
            }
            return;
        }
        const loadPromise = (async () => {
            try {
                await hass.loadBackendTranslation('config_panel', VV_DOMAIN);
            } catch {
                // Keep English fallbacks from vvTranslateCard
            }
        })();
        this._vvInflightCardLoads[lang] = loadPromise;
        await loadPromise;
        delete this._vvInflightCardLoads[lang];

        if (this._hass !== hass) {
            return;
        }
        if ((hass.language || 'en') !== lang) {
            return;
        }
        this._vvCardCategoryLoadedForLang = lang;
        this._lastRenderCacheKey = null;
        this._vvApplyHassContent(hass);
    }

    /** Update card DOM from current hass (after translations are available). */
    _vvApplyHassContent(hass) {
        if (!this.content) {
            return;
        }
        this._updateCardChrome(hass);

        const entityId = this.config.entity;
        const state = hass.states[entityId];
        if (!state) {
            const prefix = vvTranslateCard(hass, 'entity_not_found', 'Entity not found');
            this.content.innerHTML = `<p>${escHtml(prefix)}: ${escHtml(entityId)}</p>`;
            return;
        }
        const itemDetails = state.attributes.items;
        if (!itemDetails) {
            const msg = vvTranslateCard(hass, 'no_items_yet', 'No items data yet.');
            this.content.innerHTML = `<p>${escHtml(msg)}</p>`;
            return;
        }

        // Only rebuild the DOM when items data or UI language changes, so
        // user-toggled blur states are not reset on every HA state update (which
        // fires frequently on mobile and would otherwise reset the blur within
        // seconds).
        const itemsJson = JSON.stringify(itemDetails);
        const lang = hass.language || 'en';
        const renderCacheKey = `${lang}:${itemsJson}`;
        if (this._lastRenderCacheKey !== renderCacheKey) {
            this._lastRenderCacheKey = renderCacheKey;

            const separatorHtml = `<div class="separator"><br><hr></div>`;
            let vouchersHtml = `
                <voucher-refresh-button entity="${escHtml(entityId)}"></voucher-refresh-button>
                ${separatorHtml}
            `;
            for (const item of itemDetails) {
                if (item.is_used) {
                    continue; // Skip already-used vouchers
                }
                vouchersHtml += `
                    ${this.generateItemHtml(hass, item, entityId)}
                    ${separatorHtml}
                `;
            }

            this.content.innerHTML = vouchersHtml;

            // Render barcodes, or defer until bwip-js finishes loading
            if (window.bwipjs) {
                this._renderBwipBarcodes();
            } else {
                const script = document.getElementById('bwip-js-script');
                if (script) {
                    script.addEventListener('load', () => this._renderBwipBarcodes(), { once: true });
                }
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

    // Called by Home Assistant each time the state changes
    set hass(hass) {
        // Initialize card structure on first render
        if (!this.content) {
            this.innerHTML = `
                <ha-card header="VoucherVault">
                    <div class="card-content">
                        <p class="vv-card-loading">Loading...</p>
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

        this._hass = hass;
        this._vvApplyHassContent(hass);
        void this._vvLoadCardCategoryIfNeeded(hass);
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
