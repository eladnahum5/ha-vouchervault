import {
    LitElement,
    html,
    css
} from "https://unpkg.com/lit-element@2.0.1/lit-element.js?module";

import {
    VV_DOMAIN,
    escHtml,
    vvTranslateCard,
    vvFieldLabel,
} from "/vouchervault/vouchervault-card-utils.js";

// VoucherVault brand accent (indigo/violet). Kept as a single tunable pair
// so the whole card's accent can be adjusted from one place.
const VV_ACCENT = "#6366f1";
const VV_ACCENT_DARK = "#4f46e5";

const buttonStyle = css`
    button {
        padding: 10px 18px;
        border-radius: 10px;
        border: none;
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        color: white;
        font-weight: 600;
        font-size: 0.92em;
        letter-spacing: 0.01em;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(79, 70, 229, 0.35);
        transition: filter 0.15s ease, transform 0.05s ease;
    }
    button:hover {
        filter: brightness(1.08);
    }
    button:active {
        transform: translateY(1px);
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
        // Slightly muted variant so it doesn't visually compete with refresh.
        return css`
            ${buttonStyle}
            button {
                background: linear-gradient(135deg, #818cf8, #6366f1);
                box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
                padding: 8px 14px;
                font-size: 0.85em;
            }
        `;
    }
}

class VoucherVaultCard extends HTMLElement {
    setConfig(config) {
        if (!config.entity) {
            throw new Error("You need to define an entity");
        }

        // Track whether the user explicitly set `card_title`. When they do, we
        // use their value as-is and skip the translation lookup, so a
        // user-configured title is never overridden by a localized string.
        this._hasUserCardTitle = config.card_title != null;

        this.config = {
            ...config,
            barcode_padding: config.barcode_padding ?? 10,
            fields_to_show: config.fields_to_show ?? ["name", "issuer", "value", "expiry_date"],
            show_mark_as_used: config.show_mark_as_used ?? true,
            show_barcode: config.show_barcode ?? true,
            card_title: config.card_title ?? "VoucherVault",
            show_types: config.show_types ?? [], // Empty array means show all types
            sort_by: config.sort_by ?? "expiry_date",
            sort_order: config.sort_order ?? "asc", // "asc" or "desc"
            barcode_scale: config.barcode_scale ?? 2,
            show_search: config.show_search ?? true,
        };

        // throw error if sort_by is not in fields_to_show
        if (!this.config.fields_to_show.includes(this.config.sort_by)) {
            throw new Error("sort_by field must be included in fields_to_show (fields_to_show default is [name, issuer, value, expiry_date])");
        }

        // throw error if sort_order is not "asc" or "desc"
        if (!["asc", "desc"].includes(this.config.sort_order)) {
            throw new Error("sort_order must be 'asc' or 'desc'");
        }

        // throw error if barcode_scale is not a positive number
        if (typeof this.config.barcode_scale !== "number" || this.config.barcode_scale <= 0) {
            throw new Error("barcode_scale must be a positive number");
        }

        // Inject bwip-js once for client-side barcode rendering. Skip entirely
        // when barcodes are hidden, so the extra script is never loaded.
        if (this.config.show_barcode && !document.getElementById('bwip-js-script')) {
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
            // If the user configured `card_title`, use it directly. Otherwise
            // fall back to the translated title (or the default).
            const title = this._hasUserCardTitle
                ? this.config.card_title
                : vvTranslateCard(hass, 'title', this.config.card_title);
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
                        scale: this.config.barcode_scale,
                        includetext: true,
                        backgroundcolor: 'ffffff',
                        paddingwidth: padding,
                        paddingheight: padding,
                    });

                // Let the canvas display at its natural rendered size (driven by scale),
                // but cap it so it never overflows the card.
                canvas.style.maxWidth = ['qrcode', 'datamatrix', 'azteccode']
                    .includes(canvas.dataset.codeType) ? '50%' : '100%';
                canvas.style.width = '';    // clear any previous override
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
        // Loop through fields_to_show and only include those that have a
        // value on this item. All fields are optional: not every voucher or
        // gift card has every field (e.g. no expiry_date), so a missing value
        // is simply omitted rather than flagged as an error. Whether a field
        // name is valid at all is VoucherVault's concern, not this card's.
        let fieldsHtml = '';
        for (const field of this.config.fields_to_show) {
            if (item[field]) {
                const displayField = vvFieldLabel(hass, field);
                // First shown field acts as the item's "title" line for a bit
                // more visual hierarchy; the rest read as ordinary detail rows.
                if (field === this.config.fields_to_show[0]) {
                    fieldsHtml += `<div class="vv-item-title">${escHtml(item[field])}</div>`;
                } else {
                    fieldsHtml += `<div class="vv-item-field"><span class="vv-item-label">${escHtml(displayField)}</span>: ${escHtml(item[field])}</div>`;
                }
            }
        }
        const pinnedClass = item.is_pinned ? ' vv-pinned' : '';
        const pinnedBadge = item.is_pinned
            ? `<span class="vv-pin-badge">${escHtml(vvTranslateCard(hass, 'pinned', 'Pinned'))}</span>`
            : '';
        return `
                <div class="voucher-item${pinnedClass}">
                    ${pinnedBadge}
                    ${fieldsHtml}
                    ${this.config.show_mark_as_used && item.id ? `<div class="vv-item-actions"><mark-as-used-button item_id="${escHtml(item.id)}" entity="${escHtml(entityId)}"></mark-as-used-button></div>` : ''}
                    ${this.config.show_barcode ? `<div class="vv-barcode-wrap">${this.generateBarcodeHtml(item.redeem_code, item.code_type)}</div>` : ''}
                </div>
            `;
    }

    sortItems(items) {
        // sort by the sort_by field in either ascending or descending order based on sort_order config
        const sortBy = this.config.sort_by;
        const sortOrder = this.config.sort_order;
        items.sort((a, b) => {
            const aValue = a.item[sortBy] || '';
            const bValue = b.item[sortBy] || '';
            if (aValue < bValue) {
                return sortOrder === 'asc' ? -1 : 1;
            } else if (aValue > bValue) {
                return sortOrder === 'asc' ? 1 : -1;
            } else {
                return 0;
            }
        });

        // now sort by is_pinned
        items.sort((a, b) => {
            if (a.item.is_pinned && !b.item.is_pinned) {
                return -1;
            } else if (!a.item.is_pinned && b.item.is_pinned) {
                return 1;
            } else {
                return 0;
            }
        });
        return items;
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
        const renderCacheKey = `${lang}:${this._searchQuery || ''}:${this._searchBy}:${itemsJson}`;
        if (this._lastRenderCacheKey !== renderCacheKey) {
            this._lastRenderCacheKey = renderCacheKey;

            const searchByOptionsHtml = this.config.fields_to_show
                .map(field => `<option value="${escHtml(field)}" ${field === this._searchBy ? 'selected' : ''}>${escHtml(vvFieldLabel(hass, field))}</option>`)
                .join('');
            let vouchersHtml = `
                ${this.config.show_search ? `
                <div class="vv-search-row">
                    <input
                        type="text"
                        class="vv-search-input"
                        placeholder="${escHtml(vvTranslateCard(hass, 'search_placeholder', 'Search vouchers...'))}"
                        value="${escHtml(this._searchQuery || '')}"
                    >
                    <select class="vv-search-by-select">
                        ${searchByOptionsHtml}
                    </select>
                </div>
                ` : ''}
                <voucher-refresh-button entity="${escHtml(entityId)}"></voucher-refresh-button>
                <div class="vv-items-list">
            `;

            let itemsToShow = []; // list of dictionaries with keys "item" and "html"
            for (const item of itemDetails) {
                // check if item type is in filter list (if filter list is not empty)
                if (this.config.show_types.length > 0 && !this.config.show_types.includes(item.type)) {
                    continue;
                }
                if (item.is_used) {
                    continue; // Skip already-used vouchers
                }
                // filter by search query against the currently selected search_by field (case-insensitive)
                if (this._searchQuery && !(item[this._searchBy] || '').toLowerCase().includes(this._searchQuery.toLowerCase())) {
                    continue;
                }
                const itemHtml = this.generateItemHtml(hass, item, entityId);
                itemsToShow.push({
                    "item": item,
                    "html": itemHtml
                })
            }
            // add each item's HTML to vouchersHtml, show item.is_pinned = true items first
            itemsToShow = this.sortItems(itemsToShow);
            vouchersHtml += itemsToShow.map(i => i.html).join('');
            vouchersHtml += `</div>`;

            this.content.innerHTML = vouchersHtml;

            // Render barcodes, or defer until bwip-js finishes loading. Skipped
            // entirely when barcodes are hidden, since no canvases exist.
            if (this.config.show_barcode) {
                if (window.bwipjs) {
                    this._renderBwipBarcodes();
                } else {
                    const script = document.getElementById('bwip-js-script');
                    if (script) {
                        script.addEventListener('load', () => this._renderBwipBarcodes(), { once: true });
                    }
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
                    <style>
                        vouchervault-card ha-card {
                            --vv-accent: ${VV_ACCENT};
                            --vv-accent-dark: ${VV_ACCENT_DARK};
                        }
                        vouchervault-card .card-content {
                            padding: 16px;
                        }
                        vouchervault-card .vv-search-row {
                            display: flex;
                            gap: 8px;
                            margin-bottom: 14px;
                        }
                        vouchervault-card .vv-search-input {
                            flex: 1 1 auto;
                            min-width: 0;
                            box-sizing: border-box;
                            padding: 10px 14px;
                            border-radius: 10px;
                            border: 1px solid var(--divider-color, #ddd);
                            background: var(--card-background-color, #fff);
                            color: var(--primary-text-color, inherit);
                            font-size: 15px;
                            transition: border-color 0.15s ease, box-shadow 0.15s ease;
                        }
                        vouchervault-card .vv-search-input:focus {
                            outline: none;
                            border-color: var(--vv-accent, #6366f1);
                            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
                        }
                        vouchervault-card .vv-search-by-select {
                            flex: 0 0 auto;
                            box-sizing: border-box;
                            padding: 0 10px;
                            border-radius: 10px;
                            border: 1px solid var(--divider-color, #ddd);
                            background: var(--card-background-color, #fff);
                            color: var(--primary-text-color, inherit);
                            font-size: 13px;
                        }
                        vouchervault-card .vv-items-list {
                            display: flex;
                            flex-direction: column;
                            gap: 12px;
                            margin-top: 14px;
                        }
                        vouchervault-card .voucher-item {
                            position: relative;
                            border-radius: 12px;
                            border: 1px solid var(--divider-color, rgba(0,0,0,0.08));
                            background: var(--card-background-color, #fff);
                            padding: 14px 16px 14px 18px;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                            transition: box-shadow 0.15s ease, transform 0.1s ease;
                        }
                        vouchervault-card .voucher-item:hover {
                            box-shadow: 0 3px 10px rgba(0,0,0,0.1);
                        }
                        vouchervault-card .voucher-item::before {
                            content: "";
                            position: absolute;
                            left: 0;
                            top: 0;
                            bottom: 0;
                            width: 4px;
                            border-radius: 4px 0 0 4px;
                            background: var(--divider-color, rgba(0,0,0,0.08));
                        }
                        vouchervault-card .voucher-item.vv-pinned::before {
                            background: linear-gradient(180deg, var(--vv-accent, #6366f1), var(--vv-accent-dark, #4f46e5));
                        }
                        vouchervault-card .vv-pin-badge {
                            display: inline-block;
                            font-size: 0.72em;
                            font-weight: 600;
                            letter-spacing: 0.03em;
                            text-transform: uppercase;
                            color: white;
                            background: linear-gradient(135deg, var(--vv-accent, #6366f1), var(--vv-accent-dark, #4f46e5));
                            padding: 2px 8px;
                            border-radius: 999px;
                            margin-bottom: 8px;
                        }
                        vouchervault-card .vv-item-title {
                            font-size: 1.05em;
                            font-weight: 600;
                            margin-bottom: 4px;
                        }
                        vouchervault-card .vv-item-field {
                            font-size: 0.92em;
                            opacity: 0.85;
                            line-height: 1.5;
                        }
                        vouchervault-card .vv-item-label {
                            font-weight: 500;
                            opacity: 0.75;
                        }
                        vouchervault-card .vv-item-actions {
                            margin: 10px 0;
                        }
                        vouchervault-card .vv-barcode-wrap {
                            margin-top: 8px;
                        }
                    </style>
                    <div class="card-content">
                        <p class="vv-card-loading">Loading...</p>
                    </div>
                </ha-card>
            `;
            this.content = this.querySelector('.card-content');
            this._searchQuery = '';
            // Must match the option the select renders as selected (the first
            // one), otherwise searching before touching the dropdown would
            // filter against a nonexistent field and hide every item.
            this._searchBy = this.config.fields_to_show[0];

            // Delegate canvas clicks here once so the listener survives innerHTML
            // replacements. HA's CSP blocks inline onclick attributes.
            this.content.addEventListener('click', (e) => {
                if (e.target.matches('canvas[data-bwip]')) {
                    const c = e.target;
                    c.style.filter = c.style.filter === 'blur(5px)' ? 'none' : 'blur(5px)';
                }
            });

            // delegated input listener for the search box.
            // Re-renders on every keystroke, then restores focus/caret since
            // innerHTML replacement would otherwise blur the field.
            this.content.addEventListener('input', (e) => {
                if (e.target.matches('.vv-search-input')) {
                    this._searchQuery = e.target.value;
                    const caret = e.target.selectionStart;
                    this._vvApplyHassContent(this._hass);
                    const newInput = this.content.querySelector('.vv-search-input');
                    if (newInput) {
                        newInput.focus();
                        newInput.setSelectionRange(caret, caret);
                    }
                }
            });

            // delegated change listener for the "search by" field dropdown.
            this.content.addEventListener('change', (e) => {
                if (e.target.matches('.vv-search-by-select')) {
                    this._searchBy = e.target.value;
                    this._vvApplyHassContent(this._hass);
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
