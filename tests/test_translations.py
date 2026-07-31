"""Tests for VoucherVault translation files."""

import json
from pathlib import Path

import pytest

_COMPONENT_DIR = Path(__file__).parent.parent / "custom_components" / "vouchervault"
_PANEL_KEY = "vouchervault_lovelace"
_LOCALE_FILES = sorted((_COMPONENT_DIR / "translations").glob("*.json"))


def _card_strings(path: Path) -> dict:
    """Return the Lovelace card copy from a strings or translation file."""
    return json.loads(path.read_text(encoding="utf-8"))["config_panel"][_PANEL_KEY]


def _flat_keys(strings: dict, prefix: str = "") -> set[str]:
    """Return dotted key paths for every entry, including nested ones."""
    keys: set[str] = set()
    for key, value in strings.items():
        keys.add(f"{prefix}{key}")
        if isinstance(value, dict):
            keys |= _flat_keys(value, f"{prefix}{key}.")
    return keys


@pytest.mark.parametrize("locale_file", _LOCALE_FILES, ids=lambda path: path.stem)
def test_locale_matches_strings_keys(locale_file: Path) -> None:
    """Test every locale defines exactly the keys declared in `strings.json`."""
    expected = _flat_keys(_card_strings(_COMPONENT_DIR / "strings.json"))
    assert _flat_keys(_card_strings(locale_file)) == expected


@pytest.mark.parametrize("locale_file", _LOCALE_FILES, ids=lambda path: path.stem)
@pytest.mark.parametrize("key", ["pinned", "search_placeholder"])
def test_card_string_is_translated(locale_file: Path, key: str) -> None:
    """Test the card's search and pinned copy is translated, not left in English."""
    value = _card_strings(locale_file)[key]
    assert value
    if locale_file.stem != "en":
        assert value != _card_strings(_COMPONENT_DIR / "strings.json")[key]
