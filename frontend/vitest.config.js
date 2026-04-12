import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const litUnpkg =
    "https://unpkg.com/lit-element@2.0.1/lit-element.js?module";
const litLocal = resolve(
    __dirname,
    "node_modules/lit-element/lit-element.js",
);
const cardUtils = resolve(
    __dirname,
    "../custom_components/vouchervault/frontend/vouchervault-card-utils.js",
);

export default defineConfig({
    test: {
        environment: "jsdom",
        globals: false,
        include: ["__tests__/**/*.test.js"],
    },
    resolve: {
        alias: {
            [litUnpkg]: litLocal,
            "/vouchervault/vouchervault-card-utils.js": cardUtils,
        },
    },
});
