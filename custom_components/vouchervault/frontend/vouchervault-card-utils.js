/** Integration domain; must match custom_components folder name. */
export const VV_DOMAIN = "vouchervault";
/**
 * Slug under strings `config_panel` for Lovelace card copy (hassfest allows
 * config_panel; a top-level `card` key is rejected).
 */
export const VV_LOVELACE_PANEL = "vouchervault_lovelace";

// Escape special HTML characters to prevent broken markup or XSS when
// inserting untrusted strings into innerHTML.
export function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** @param {object} hass @param {string} subKey @param {string} fallback */
export function vvTranslateCard(hass, subKey, fallback) {
    const key = `component.${VV_DOMAIN}.config_panel.${VV_LOVELACE_PANEL}.${subKey}`;
    const out = hass.localize(key);
    if (!out || out === key) {
        return fallback;
    }
    return out;
}

/** @param {object} hass @param {string} field */
export function vvFieldLabel(hass, field) {
    const fallback = field
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
    return vvTranslateCard(hass, `fields.${field}`, fallback);
}
