import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../../custom_components/vouchervault/frontend/vouchervault-card.js";

const ENTITY = "sensor.vouchervault_192_168_1_100_8000_item_details";

function makeHass(overrides = {}) {
    const callService = vi.fn().mockResolvedValue(undefined);
    return {
        states: {},
        callService,
        localize: (key) => key,
        language: "en",
        loadBackendTranslation: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

describe("VoucherVaultCard", () => {
    beforeEach(() => {
        window.bwipjs = { toCanvas: vi.fn() };
    });

    afterEach(() => {
        delete window.bwipjs;
        vi.restoreAllMocks();
    });

    it("setConfig throws without entity", () => {
        const card = document.createElement("vouchervault-card");
        expect(() => card.setConfig({})).toThrow("You need to define an entity");
    });

    it("shows entity not found when state is missing", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY });
        const hass = makeHass({ states: {} });
        card.hass = hass;
        await Promise.resolve();
        expect(card.textContent).toContain("Entity not found");
        expect(card.textContent).toContain(ENTITY);
    });

    it("shows no items when attributes lack items", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY });
        const hass = makeHass({
            states: {
                [ENTITY]: { state: "0", attributes: {} },
            },
        });
        card.hass = hass;
        await Promise.resolve();
        expect(card.textContent).toMatch(/No items data yet/i);
    });

    it("skips used items and renders active voucher", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY });
        const items = [
            {
                id: "used1",
                name: "Used",
                issuer: "X",
                value: "1",
                expiry_date: "2099-01-01",
                redeem_code: "U",
                code_type: "qrcode",
                is_used: true,
            },
            {
                id: "a1",
                name: "Active",
                issuer: "Store",
                value: "10",
                expiry_date: "2099-01-01",
                redeem_code: "CODE",
                code_type: "qrcode",
                is_used: false,
            },
        ];
        const hass = makeHass({
            states: {
                [ENTITY]: { state: "2", attributes: { items } },
            },
        });
        card.hass = hass;
        await Promise.resolve();
        expect(card.textContent).toContain("Active");
        expect(card.textContent).not.toContain("Used");
        expect(card.querySelectorAll("mark-as-used-button").length).toBe(1);
    });

    it("uses configured card_title verbatim without a translation lookup", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY, card_title: "My Vouchers" });
        // localize returns a translated title, but it must be ignored because
        // the user configured card_title explicitly.
        const localize = vi.fn(() => "Translated Title");
        const hass = makeHass({
            localize,
            states: {
                [ENTITY]: { state: "0", attributes: {} },
            },
        });
        card.hass = hass;
        await Promise.resolve();
        const haCard = card.querySelector("ha-card");
        expect(haCard.getAttribute("header")).toBe("My Vouchers");
    });

    it("uses the translated title when card_title is not configured", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY });
        const hass = makeHass({
            localize: () => "Translated Title",
            states: {
                [ENTITY]: { state: "0", attributes: {} },
            },
        });
        card.hass = hass;
        await Promise.resolve();
        const haCard = card.querySelector("ha-card");
        expect(haCard.getAttribute("header")).toBe("Translated Title");
    });

    it("omits expiry_date silently when the item has no value for it", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY });
        const hass = makeHass({
            states: {
                [ENTITY]: {
                    state: "1",
                    attributes: {
                        items: [
                            {
                                id: "no-exp",
                                name: "NoExpiry",
                                issuer: "Store",
                                value: "5",
                                // expiry_date intentionally omitted
                                redeem_code: "CODE",
                                code_type: "qrcode",
                                is_used: false,
                            },
                        ],
                    },
                },
            },
        });
        card.hass = hass;
        await Promise.resolve();
        expect(card.textContent).toContain("NoExpiry");
        expect(card.textContent).not.toMatch(/field not found/i);
        expect(card.textContent).not.toMatch(/expiry date/i);
    });

    it("omits any field silently when the item has no value for it, regardless of the field name", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({
            entity: ENTITY,
            fields_to_show: ["name", "totally_made_up_field"],
            sort_by: "name",
        });
        const hass = makeHass({
            states: {
                [ENTITY]: {
                    state: "1",
                    attributes: {
                        items: [
                            {
                                id: "a1",
                                name: "Active",
                                redeem_code: "CODE",
                                code_type: "qrcode",
                                is_used: false,
                            },
                        ],
                    },
                },
            },
        });
        card.hass = hass;
        await Promise.resolve();
        expect(card.textContent).toContain("Active");
        expect(card.textContent).not.toMatch(/field not found/i);
        expect(card.textContent).not.toContain("totally_made_up_field");
    });

    it("hides the barcode canvas when show_barcode is false", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY, show_barcode: false });
        const hass = makeHass({
            states: {
                [ENTITY]: {
                    state: "1",
                    attributes: {
                        items: [
                            {
                                id: "a1",
                                name: "Active",
                                issuer: "Store",
                                value: "10",
                                expiry_date: "2099-01-01",
                                redeem_code: "CODE",
                                code_type: "qrcode",
                                is_used: false,
                            },
                        ],
                    },
                },
            },
        });
        card.hass = hass;
        await Promise.resolve();
        expect(card.querySelector("canvas[data-bwip]")).toBeNull();
    });

    it("shows the barcode canvas by default", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY });
        const hass = makeHass({
            states: {
                [ENTITY]: {
                    state: "1",
                    attributes: {
                        items: [
                            {
                                id: "a1",
                                name: "Active",
                                issuer: "Store",
                                value: "10",
                                expiry_date: "2099-01-01",
                                redeem_code: "CODE",
                                code_type: "qrcode",
                                is_used: false,
                            },
                        ],
                    },
                },
            },
        });
        card.hass = hass;
        await Promise.resolve();
        expect(card.querySelector("canvas[data-bwip]")).toBeTruthy();
    });

    it("refresh button calls homeassistant.update_entity", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY });
        const hass = makeHass({
            states: {
                [ENTITY]: {
                    state: "1",
                    attributes: {
                        items: [
                            {
                                id: "x",
                                name: "N",
                                issuer: "I",
                                value: "1",
                                expiry_date: "2099-01-01",
                                redeem_code: "R",
                                code_type: "qrcode",
                                is_used: false,
                            },
                        ],
                    },
                },
            },
        });
        card.hass = hass;
        await Promise.resolve();
        const refresh = card.querySelector("voucher-refresh-button");
        expect(refresh).toBeTruthy();
        refresh.hass = hass;
        await refresh._click();
        expect(hass.callService).toHaveBeenCalledWith(
            "homeassistant",
            "update_entity",
            { entity_id: ENTITY },
        );
    });

    it("mark-as-used calls vouchervault.toggle_item_status then update_entity", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY });
        const hass = makeHass({
            states: {
                [ENTITY]: {
                    state: "1",
                    attributes: {
                        items: [
                            {
                                id: "item-99",
                                name: "N",
                                issuer: "I",
                                value: "1",
                                expiry_date: "2099-01-01",
                                redeem_code: "R",
                                code_type: "qrcode",
                                is_used: false,
                            },
                        ],
                    },
                },
            },
        });
        card.hass = hass;
        await Promise.resolve();
        const mark = card.querySelector("mark-as-used-button");
        expect(mark).toBeTruthy();
        mark.hass = hass;
        await mark._click();
        expect(hass.callService).toHaveBeenCalledWith(
            "vouchervault",
            "toggle_item_status",
            { item_id: "item-99" },
        );
        expect(hass.callService).toHaveBeenCalledWith(
            "homeassistant",
            "update_entity",
            { entity_id: ENTITY },
        );
    });
});
