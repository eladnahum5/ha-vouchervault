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
