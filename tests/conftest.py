"""Common fixtures for the VoucherVault tests."""

from collections.abc import Generator
from unittest.mock import AsyncMock, patch

import pytest # type: ignore


@pytest.fixture
def mock_setup_entry() -> Generator[AsyncMock]:
    """Override async_setup_entry."""
    with patch(
        "custom_components.vouchervault.async_setup_entry", return_value=True
    ) as mock_setup_entry:
        yield mock_setup_entry
