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
        // Scoped to the item body: the search dropdown lists every configured
        // field, so "Expiry date" legitimately appears elsewhere on the card.
        const item = card.querySelector(".voucher-item");
        expect(item.textContent).not.toMatch(/expiry date/i);
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
        const item = card.querySelector(".voucher-item");
        expect(item.textContent).not.toMatch(/totally.made.up.field/i);
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

describe("VoucherVaultCard config validation", () => {
    it("rejects barcode_scale of zero", () => {
        const card = document.createElement("vouchervault-card");
        expect(() =>
            card.setConfig({ entity: ENTITY, barcode_scale: 0 }),
        ).toThrow("barcode_scale must be a positive number");
    });

    it("rejects a negative barcode_scale", () => {
        const card = document.createElement("vouchervault-card");
        expect(() =>
            card.setConfig({ entity: ENTITY, barcode_scale: -2 }),
        ).toThrow("barcode_scale must be a positive number");
    });

    it("rejects a non-number barcode_scale", () => {
        const card = document.createElement("vouchervault-card");
        expect(() =>
            card.setConfig({ entity: ENTITY, barcode_scale: "2" }),
        ).toThrow("barcode_scale must be a positive number");
    });

    it("accepts a positive numeric barcode_scale", () => {
        const card = document.createElement("vouchervault-card");
        expect(() =>
            card.setConfig({ entity: ENTITY, barcode_scale: 3 }),
        ).not.toThrow();
    });

    it("rejects sort_by not included in fields_to_show", () => {
        const card = document.createElement("vouchervault-card");
        expect(() =>
            card.setConfig({
                entity: ENTITY,
                fields_to_show: ["name"],
                sort_by: "issuer",
            }),
        ).toThrow(/sort_by field must be included in fields_to_show/);
    });

    it("rejects an invalid sort_order", () => {
        const card = document.createElement("vouchervault-card");
        expect(() =>
            card.setConfig({ entity: ENTITY, sort_order: "sideways" }),
        ).toThrow("sort_order must be 'asc' or 'desc'");
    });
});

describe("VoucherVaultCard sorting and filtering", () => {
    beforeEach(() => {
        window.bwipjs = { toCanvas: vi.fn() };
    });

    afterEach(() => {
        delete window.bwipjs;
        vi.restoreAllMocks();
    });

    function itemsFixture() {
        return [
            {
                id: "b",
                name: "Beta",
                issuer: "Store",
                value: "10",
                expiry_date: "2099-03-01",
                redeem_code: "B",
                code_type: "qrcode",
                is_used: false,
                type: "voucher",
            },
            {
                id: "a",
                name: "Alpha",
                issuer: "Store",
                value: "20",
                expiry_date: "2099-01-01",
                redeem_code: "A",
                code_type: "qrcode",
                is_used: false,
                type: "gift_card",
            },
            {
                id: "c",
                name: "Charlie",
                issuer: "Store",
                value: "30",
                expiry_date: "2099-02-01",
                redeem_code: "C",
                code_type: "qrcode",
                is_used: false,
                type: "voucher",
                is_pinned: true,
            },
        ];
    }

    function renderOrder(card) {
        const names = [...card.querySelectorAll(".voucher-item")].map(
            (el) => el.textContent,
        );
        return names;
    }

    it("sorts ascending by expiry_date by default", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY });
        const hass = makeHass({
            states: { [ENTITY]: { state: "3", attributes: { items: itemsFixture() } } },
        });
        card.hass = hass;
        await Promise.resolve();
        const order = renderOrder(card);
        // Charlie is pinned, so it always comes first regardless of sort field.
        expect(order[0]).toContain("Charlie");
        expect(order[1]).toContain("Alpha");
        expect(order[2]).toContain("Beta");
    });

    it("sorts descending when sort_order is desc", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY, sort_order: "desc" });
        const hass = makeHass({
            states: { [ENTITY]: { state: "3", attributes: { items: itemsFixture() } } },
        });
        card.hass = hass;
        await Promise.resolve();
        const order = renderOrder(card);
        // Pinned item still sorts first even in descending order.
        expect(order[0]).toContain("Charlie");
        expect(order[1]).toContain("Beta");
        expect(order[2]).toContain("Alpha");
    });

    it("sorts by an alternate sort_by field", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({
            entity: ENTITY,
            fields_to_show: ["name", "issuer", "value", "expiry_date"],
            sort_by: "name",
        });
        const hass = makeHass({
            states: { [ENTITY]: { state: "3", attributes: { items: itemsFixture() } } },
        });
        card.hass = hass;
        await Promise.resolve();
        const order = renderOrder(card);
        expect(order[0]).toContain("Charlie"); // pinned wins regardless
        expect(order[1]).toContain("Alpha");
        expect(order[2]).toContain("Beta");
    });

    it("filters items by show_types", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY, show_types: ["gift_card"] });
        const hass = makeHass({
            states: { [ENTITY]: { state: "3", attributes: { items: itemsFixture() } } },
        });
        card.hass = hass;
        await Promise.resolve();
        expect(card.textContent).toContain("Alpha");
        expect(card.textContent).not.toContain("Beta");
        expect(card.textContent).not.toContain("Charlie");
    });

    it("shows all types when show_types is empty", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY, show_types: [] });
        const hass = makeHass({
            states: { [ENTITY]: { state: "3", attributes: { items: itemsFixture() } } },
        });
        card.hass = hass;
        await Promise.resolve();
        expect(card.textContent).toContain("Alpha");
        expect(card.textContent).toContain("Beta");
        expect(card.textContent).toContain("Charlie");
    });
});

describe("VoucherVaultCard search bar", () => {
    beforeEach(() => {
        window.bwipjs = { toCanvas: vi.fn() };
    });

    afterEach(() => {
        delete window.bwipjs;
        vi.restoreAllMocks();
    });

    function searchItems() {
        return [
            {
                id: "a",
                name: "Alpha",
                issuer: "AcmeCo",
                value: "20",
                expiry_date: "2099-01-01",
                redeem_code: "A",
                code_type: "qrcode",
                is_used: false,
            },
            {
                id: "b",
                name: "Beta",
                issuer: "Globex",
                value: "10",
                expiry_date: "2099-03-01",
                redeem_code: "B",
                code_type: "qrcode",
                is_used: false,
            },
            {
                id: "c",
                name: "Alphabet Soup",
                issuer: "Globex",
                value: "30",
                expiry_date: "2099-02-01",
                redeem_code: "C",
                code_type: "qrcode",
                is_used: false,
            },
        ];
    }

    function makeCard(config = {}, items = searchItems(), hassOverrides = {}) {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY, ...config });
        const hass = makeHass({
            states: {
                [ENTITY]: { state: String(items.length), attributes: { items } },
            },
            ...hassOverrides,
        });
        card.hass = hass;
        return { card, hass };
    }

    // Item titles are the first configured field, so they identify which
    // vouchers survived filtering without picking up search dropdown text.
    function shownNames(card) {
        return [...card.querySelectorAll(".voucher-item .vv-item-title")].map(
            (el) => el.textContent.trim(),
        );
    }

    async function typeQuery(card, query) {
        const input = card.querySelector(".vv-search-input");
        input.value = query;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await Promise.resolve();
    }

    async function chooseSearchBy(card, field) {
        const select = card.querySelector(".vv-search-by-select");
        select.value = field;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        await Promise.resolve();
    }

    it("renders the search input and field dropdown by default", async () => {
        const { card } = makeCard();
        await Promise.resolve();
        expect(card.querySelector(".vv-search-row")).toBeTruthy();
        expect(card.querySelector(".vv-search-input")).toBeTruthy();
        expect(card.querySelector(".vv-search-by-select")).toBeTruthy();
    });

    it("hides the search row when show_search is false but still lists items", async () => {
        const { card } = makeCard({ show_search: false });
        await Promise.resolve();
        expect(card.querySelector(".vv-search-row")).toBeNull();
        expect(card.querySelector(".vv-search-input")).toBeNull();
        expect(shownNames(card)).toHaveLength(3);
    });

    it("offers one dropdown option per configured field, labeled for display", async () => {
        const { card } = makeCard();
        await Promise.resolve();
        const options = [...card.querySelectorAll(".vv-search-by-select option")];
        expect(options.map((o) => o.value)).toEqual([
            "name",
            "issuer",
            "value",
            "expiry_date",
        ]);
        expect(options.map((o) => o.textContent.trim())).toEqual([
            "Name",
            "Issuer",
            "Value",
            "Expiry Date",
        ]);
    });

    it("defaults to searching the field the dropdown shows as selected", async () => {
        const { card } = makeCard();
        await Promise.resolve();
        const select = card.querySelector(".vv-search-by-select");
        // A mismatch here would filter against a nonexistent field and hide
        // every voucher as soon as the user typed anything.
        expect(card._searchBy).toBe(select.value);
        expect(card._searchBy).toBe("name");
    });

    it("shows every item before a query is entered", async () => {
        const { card } = makeCard();
        await Promise.resolve();
        expect(shownNames(card)).toEqual(["Alpha", "Alphabet Soup", "Beta"]);
    });

    it("filters items by the search query", async () => {
        const { card } = makeCard();
        await Promise.resolve();
        await typeQuery(card, "Beta");
        expect(shownNames(card)).toEqual(["Beta"]);
    });

    it("matches case-insensitively", async () => {
        const { card } = makeCard();
        await Promise.resolve();
        await typeQuery(card, "aLpHa");
        expect(shownNames(card)).toEqual(["Alpha", "Alphabet Soup"]);
    });

    it("matches on substrings, not just prefixes", async () => {
        const { card } = makeCard();
        await Promise.resolve();
        await typeQuery(card, "phabet");
        expect(shownNames(card)).toEqual(["Alphabet Soup"]);
    });

    it("renders no items but keeps the search box when nothing matches", async () => {
        const { card } = makeCard();
        await Promise.resolve();
        await typeQuery(card, "nothing matches this");
        expect(shownNames(card)).toEqual([]);
        expect(card.querySelectorAll(".voucher-item")).toHaveLength(0);
        // The input must survive an empty result set, otherwise the user has no
        // way to clear the query and get their vouchers back.
        const input = card.querySelector(".vv-search-input");
        expect(input).toBeTruthy();
        expect(input.value).toBe("nothing matches this");
    });

    it("restores all items when the query is cleared", async () => {
        const { card } = makeCard();
        await Promise.resolve();
        await typeQuery(card, "Beta");
        expect(shownNames(card)).toEqual(["Beta"]);
        await typeQuery(card, "");
        expect(shownNames(card)).toEqual(["Alpha", "Alphabet Soup", "Beta"]);
    });

    it("searches the field chosen in the dropdown", async () => {
        const { card } = makeCard();
        await Promise.resolve();
        await chooseSearchBy(card, "issuer");
        await typeQuery(card, "globex");
        expect(shownNames(card)).toEqual(["Alphabet Soup", "Beta"]);
    });

    it("keeps the chosen search field selected after re-rendering", async () => {
        const { card } = makeCard();
        await Promise.resolve();
        await chooseSearchBy(card, "issuer");
        await typeQuery(card, "acme");
        const select = card.querySelector(".vv-search-by-select");
        expect(select.value).toBe("issuer");
        expect(card._searchBy).toBe("issuer");
        expect(shownNames(card)).toEqual(["Alpha"]);
    });

    it("re-filters against the new field when the dropdown changes", async () => {
        const { card } = makeCard();
        await Promise.resolve();
        await typeQuery(card, "globex");
        // "globex" is an issuer, so nothing matches while searching by name.
        expect(shownNames(card)).toEqual([]);
        await chooseSearchBy(card, "issuer");
        expect(shownNames(card)).toEqual(["Alphabet Soup", "Beta"]);
    });

    it("treats items missing the searched field as non-matches", async () => {
        const { card } = makeCard({}, [
            {
                id: "a",
                name: "Alpha",
                issuer: "AcmeCo",
                expiry_date: "2099-01-01",
                redeem_code: "A",
                code_type: "qrcode",
                is_used: false,
            },
            {
                id: "b",
                name: "Beta",
                // issuer intentionally omitted
                expiry_date: "2099-03-01",
                redeem_code: "B",
                code_type: "qrcode",
                is_used: false,
            },
        ]);
        await Promise.resolve();
        await chooseSearchBy(card, "issuer");
        await typeQuery(card, "acme");
        expect(shownNames(card)).toEqual(["Alpha"]);
    });

    it("does not resurrect used vouchers that match the query", async () => {
        const { card } = makeCard({}, [
            {
                id: "used",
                name: "Alpha Used",
                issuer: "AcmeCo",
                expiry_date: "2099-01-01",
                redeem_code: "U",
                code_type: "qrcode",
                is_used: true,
            },
            {
                id: "a",
                name: "Alpha Active",
                issuer: "AcmeCo",
                expiry_date: "2099-02-01",
                redeem_code: "A",
                code_type: "qrcode",
                is_used: false,
            },
        ]);
        await Promise.resolve();
        await typeQuery(card, "alpha");
        expect(shownNames(card)).toEqual(["Alpha Active"]);
    });

    it("applies the search on top of the show_types filter", async () => {
        const { card } = makeCard({ show_types: ["gift_card"] }, [
            {
                id: "a",
                name: "Alpha",
                issuer: "AcmeCo",
                expiry_date: "2099-01-01",
                redeem_code: "A",
                code_type: "qrcode",
                is_used: false,
                type: "gift_card",
            },
            {
                id: "b",
                name: "Alpha Voucher",
                issuer: "AcmeCo",
                expiry_date: "2099-02-01",
                redeem_code: "B",
                code_type: "qrcode",
                is_used: false,
                type: "voucher",
            },
        ]);
        await Promise.resolve();
        await typeQuery(card, "alpha");
        expect(shownNames(card)).toEqual(["Alpha"]);
    });

    it("keeps pinned matches first within the search results", async () => {
        const { card } = makeCard({}, [
            {
                id: "a",
                name: "Alpha One",
                issuer: "AcmeCo",
                expiry_date: "2099-01-01",
                redeem_code: "A",
                code_type: "qrcode",
                is_used: false,
            },
            {
                id: "b",
                name: "Alpha Two",
                issuer: "AcmeCo",
                expiry_date: "2099-03-01",
                redeem_code: "B",
                code_type: "qrcode",
                is_used: false,
                is_pinned: true,
            },
        ]);
        await Promise.resolve();
        await typeQuery(card, "alpha");
        expect(shownNames(card)).toEqual(["Alpha Two", "Alpha One"]);
    });

    it("keeps focus and caret position in the input while typing", async () => {
        // focus() only takes effect for elements attached to the document.
        const { card } = makeCard();
        document.body.appendChild(card);
        try {
            // Let the initial translation load settle first: it re-renders the
            // card once resolved, which would replace the input for reasons
            // unrelated to typing.
            await new Promise((resolve) => setTimeout(resolve, 0));
            const input = card.querySelector(".vv-search-input");
            input.focus();
            input.value = "alph";
            input.setSelectionRange(2, 2);
            // The restore is synchronous, so assert without yielding.
            input.dispatchEvent(new Event("input", { bubbles: true }));
            const rerendered = card.querySelector(".vv-search-input");
            expect(rerendered).not.toBe(input);
            expect(document.activeElement).toBe(rerendered);
            expect(rerendered.selectionStart).toBe(2);
        } finally {
            card.remove();
        }
    });

    it("matches queries containing HTML-escaped characters", async () => {
        const { card } = makeCard({}, [
            {
                id: "a",
                name: "Ben & Jerry's",
                issuer: "AcmeCo",
                expiry_date: "2099-01-01",
                redeem_code: "A",
                code_type: "qrcode",
                is_used: false,
            },
            {
                id: "b",
                name: "Beta",
                issuer: "AcmeCo",
                expiry_date: "2099-03-01",
                redeem_code: "B",
                code_type: "qrcode",
                is_used: false,
            },
        ]);
        await Promise.resolve();
        await typeQuery(card, "ben &");
        expect(shownNames(card)).toEqual(["Ben & Jerry's"]);
    });

    it("escapes a quote-bearing query instead of breaking the input markup", async () => {
        const { card } = makeCard();
        await Promise.resolve();
        await typeQuery(card, '"><script>bad()</script>');
        const input = card.querySelector(".vv-search-input");
        expect(input).toBeTruthy();
        expect(input.value).toBe('"><script>bad()</script>');
        expect(card.querySelector("script")).toBeNull();
    });

    it("uses the translated placeholder when one is available", async () => {
        const { card } = makeCard(
            {},
            searchItems(),
            {
                localize: (key) =>
                    key.endsWith("search_placeholder") ? "Gutscheine suchen..." : key,
            },
        );
        await Promise.resolve();
        expect(
            card.querySelector(".vv-search-input").getAttribute("placeholder"),
        ).toBe("Gutscheine suchen...");
    });

    it("falls back to the English placeholder when untranslated", async () => {
        const { card } = makeCard();
        await Promise.resolve();
        expect(
            card.querySelector(".vv-search-input").getAttribute("placeholder"),
        ).toBe("Search vouchers...");
    });
});

describe("VoucherVaultCard pinned item indicator", () => {
    beforeEach(() => {
        window.bwipjs = { toCanvas: vi.fn() };
    });

    afterEach(() => {
        delete window.bwipjs;
        vi.restoreAllMocks();
    });

    function renderItem(item, hassOverrides = {}) {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY });
        const hass = makeHass({
            states: { [ENTITY]: { state: "1", attributes: { items: [item] } } },
            ...hassOverrides,
        });
        card.hass = hass;
        return card;
    }

    function baseItem(overrides = {}) {
        return {
            id: "a",
            name: "Alpha",
            issuer: "AcmeCo",
            value: "20",
            expiry_date: "2099-01-01",
            redeem_code: "A",
            code_type: "qrcode",
            is_used: false,
            ...overrides,
        };
    }

    it("marks a pinned item with the pinned class and badge", async () => {
        const card = renderItem(baseItem({ is_pinned: true }));
        await Promise.resolve();
        const item = card.querySelector(".voucher-item");
        expect(item.classList.contains("vv-pinned")).toBe(true);
        const badge = item.querySelector(".vv-pin-badge");
        expect(badge).toBeTruthy();
        expect(badge.textContent.trim()).toBe("Pinned");
    });

    it("omits the pinned class and badge for an unpinned item", async () => {
        const card = renderItem(baseItem({ is_pinned: false }));
        await Promise.resolve();
        const item = card.querySelector(".voucher-item");
        expect(item.classList.contains("vv-pinned")).toBe(false);
        expect(item.querySelector(".vv-pin-badge")).toBeNull();
    });

    it("treats an item without is_pinned as unpinned", async () => {
        const card = renderItem(baseItem());
        await Promise.resolve();
        const item = card.querySelector(".voucher-item");
        expect(item.classList.contains("vv-pinned")).toBe(false);
        expect(item.querySelector(".vv-pin-badge")).toBeNull();
    });

    it("renders the badge before the item's title", async () => {
        const card = renderItem(baseItem({ is_pinned: true }));
        await Promise.resolve();
        const item = card.querySelector(".voucher-item");
        const badge = item.querySelector(".vv-pin-badge");
        const title = item.querySelector(".vv-item-title");
        expect(
            badge.compareDocumentPosition(title) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it("uses the translated pinned label when one is available", async () => {
        const card = renderItem(baseItem({ is_pinned: true }), {
            localize: (key) => (key.endsWith("pinned") ? "Angepinnt" : key),
        });
        await Promise.resolve();
        expect(
            card.querySelector(".vv-pin-badge").textContent.trim(),
        ).toBe("Angepinnt");
    });

    it("reflects a pin state change on the next hass update", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY });
        const unpinned = baseItem();
        const hass = makeHass({
            states: { [ENTITY]: { state: "1", attributes: { items: [unpinned] } } },
        });
        card.hass = hass;
        await Promise.resolve();
        expect(card.querySelector(".vv-pin-badge")).toBeNull();

        const pinnedHass = makeHass({
            states: {
                [ENTITY]: {
                    state: "1",
                    attributes: { items: [baseItem({ is_pinned: true })] },
                },
            },
        });
        card.hass = pinnedHass;
        await Promise.resolve();
        const item = card.querySelector(".voucher-item");
        expect(item.classList.contains("vv-pinned")).toBe(true);
        expect(item.querySelector(".vv-pin-badge")).toBeTruthy();
    });

    it("renders the first configured field as the item title and the rest as labeled rows", async () => {
        const card = renderItem(baseItem());
        await Promise.resolve();
        const item = card.querySelector(".voucher-item");
        expect(item.querySelector(".vv-item-title").textContent.trim()).toBe(
            "Alpha",
        );
        const rows = [...item.querySelectorAll(".vv-item-field")].map((el) =>
            el.textContent.replace(/\s+/g, " ").trim(),
        );
        expect(rows).toEqual([
            "Issuer: AcmeCo",
            "Value: 20",
            "Expiry Date: 2099-01-01",
        ]);
    });
});

describe("VoucherVaultCard backend translation loading", () => {
    beforeEach(() => {
        window.bwipjs = { toCanvas: vi.fn() };
    });

    afterEach(() => {
        delete window.bwipjs;
        vi.restoreAllMocks();
    });

    it("loads the config_panel translation category once per language", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY });
        const loadBackendTranslation = vi.fn().mockResolvedValue(undefined);
        const hass = makeHass({
            loadBackendTranslation,
            states: { [ENTITY]: { state: "0", attributes: {} } },
        });
        card.hass = hass;
        await Promise.resolve();
        await Promise.resolve();
        expect(loadBackendTranslation).toHaveBeenCalledWith(
            "config_panel",
            "vouchervault",
        );

        // Setting the same hass/language again should not re-trigger the load.
        card.hass = hass;
        await Promise.resolve();
        await Promise.resolve();
        expect(loadBackendTranslation).toHaveBeenCalledTimes(1);
    });

    it("re-applies content once the translation load resolves", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY });
        let resolveLoad;
        const loadBackendTranslation = vi.fn(
            () =>
                new Promise((resolve) => {
                    resolveLoad = resolve;
                }),
        );
        const localize = vi.fn((key) => key);
        const hass = makeHass({
            loadBackendTranslation,
            localize,
            states: { [ENTITY]: { state: "0", attributes: {} } },
        });
        card.hass = hass;
        await Promise.resolve();

        const haCard = card.querySelector("ha-card");
        // Before the translation resolves, the header falls back to the
        // configured default title.
        expect(haCard.getAttribute("header")).toBe("VoucherVault");

        localize.mockReturnValue("Translated Title");
        resolveLoad();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(haCard.getAttribute("header")).toBe("Translated Title");
    });

    it("does not attempt translation loading when hass has no loadBackendTranslation", async () => {
        const card = document.createElement("vouchervault-card");
        card.setConfig({ entity: ENTITY });
        const hass = makeHass({
            states: { [ENTITY]: { state: "0", attributes: {} } },
        });
        delete hass.loadBackendTranslation;
        card.hass = hass;
        await Promise.resolve();
        // Should render normally without throwing despite the missing method.
        expect(card.textContent).toMatch(/No items data yet/i);
    });
});
