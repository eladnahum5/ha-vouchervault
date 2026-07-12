# Contributing to VoucherVault for Home Assistant

Thanks for your interest in contributing! This is a small open-source project, so let's keep things simple and straightforward.

***

## Ways to contribute

- Bug reports and feature requests via [Issues](https://github.com/eladnahum5/ha-vouchervault/issues)
- Code fixes or new features via Pull Requests
- New or improved translations

***

## Getting started

1. Fork the repo and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/ha-vouchervault.git
   cd ha-vouchervault
   ```
2. Create a branch off `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

***

## Project structure

```
ha-vouchervault/
├── custom_components/vouchervault/   # HA integration (Python)
│   ├── translations/                 # HA backend UI translations (JSON)
│   └── strings.json                  # Translation source strings
├── frontend/                         # Lovelace card source (JS + Vitest tests)
├── tests/                            # Backend pytest tests
├── requirements-test.txt             # Pinned test dependencies
└── pytest.ini                        # Pytest config
```

***

## Development setup

### Backend (Python)

```bash
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-test.txt
pip install aiohttp==3.12.15   # Intentional downgrade — keeps aioresponses compatible. The pip warning is safe to ignore.
```

### Frontend (Lovelace card)

```bash
cd frontend
npm install
```

***

## Running tests

CI runs both test suites automatically on every push and PR. Run them locally before opening a PR.

**Backend:**
```bash
pytest tests/
```

**Frontend:**
```bash
cd frontend
npm test
```

***

## Commit message convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/). The format matters because releases are cut manually using [release-please](https://github.com/googleapis/release-please), which reads commit types to determine the version bump (`feat` → minor, `fix` → patch).

***

## Submitting a PR

- Make sure all tests pass locally before opening the PR.
- Keep the PR focused — one logical change per PR.
- Describe what changed and why in the PR body.
- Reference related issues with `Closes #<number>` if applicable.

***

## Translations

### Backend (HA integration UI strings)

Translation files for the integration's UI (config flow, etc.) live in:
```
custom_components/vouchervault/translations/
```
`strings.json` in the same directory is the source of truth. To add a new language, copy an existing file (e.g. `en.json`), name it with the [BCP 47 language tag](https://www.iana.org/assignments/language-subtag-registry) (e.g. `nl.json`), and translate the values — not the keys.

### Frontend (Lovelace card labels)

Card UI strings (field labels, buttons, empty states) are embedded in the card source under `frontend/`. Currently bundled locales: **English (`en`)**, **German (`de`)**, **Spanish (`es`)**, **French (`fr`)**, **Hebrew (`he`)**. Check the source for where to add a new locale before submitting.

***

## Reporting bugs

Use the [Bug report](<https://github.com/eladnahum5/ha-vouchervault/issues/new?template=bug_report.yml>) issue template. It will ask you for:

- Home Assistant version
- VoucherVault integration version
- What went wrong
- Steps to reproduce

***

## Feature requests

Use the [Feature request](https://github.com/eladnahum5/ha-vouchervault/issues/new?template=feature_request.yml) issue template. It will ask you to describe the problem or goal, and your proposed change.
