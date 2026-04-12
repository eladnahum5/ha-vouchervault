import { describe, expect, it } from "vitest";

import {
    escHtml,
    vvFieldLabel,
    vvTranslateCard,
} from "../../custom_components/vouchervault/frontend/vouchervault-card-utils.js";

describe("escHtml", () => {
    it("escapes HTML special characters", () => {
        expect(escHtml(`<&>"`)).toBe("&lt;&amp;&gt;&quot;");
    });

    it("handles non-string input", () => {
        expect(escHtml(42)).toBe("42");
    });
});

describe("vvTranslateCard", () => {
    it("returns fallback when localize returns the key", () => {
        const hass = {
            localize: (key) => key,
        };
        const out = vvTranslateCard(hass, "title", "VoucherVault");
        expect(out).toBe("VoucherVault");
    });

    it("returns localized string when available", () => {
        const hass = {
            localize: () => "Titre",
        };
        expect(vvTranslateCard(hass, "title", "VoucherVault")).toBe("Titre");
    });
});

describe("vvFieldLabel", () => {
    it("uses title-case fallback when localize misses", () => {
        const hass = { localize: (key) => key };
        expect(vvFieldLabel(hass, "expiry_date")).toBe("Expiry Date");
    });
});
