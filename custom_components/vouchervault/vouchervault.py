"""VoucherVault API client."""

from __future__ import annotations

from dataclasses import dataclass, field
import logging
from typing import Any

import aiohttp

_LOGGER = logging.getLogger(__name__)


@dataclass
class ApiData:
    """Typed snapshot of the full API response."""

    item_stats: dict[str, Any] = field(default_factory=dict)
    user_stats: dict[str, Any] = field(default_factory=dict)
    issuer_stats: list[dict[str, Any]] = field(default_factory=list)
    item_details: list[dict[str, Any]] = field(default_factory=list)

    @classmethod
    def from_api_response(cls, raw: dict[str, Any]) -> ApiData:
        """Parse the raw API JSON into a typed ApiData instance."""
        return cls(
            item_stats=raw.get("item_stats", {}),
            user_stats=raw.get("user_stats", {}),
            issuer_stats=raw.get("issuer_stats", []),
            item_details=raw.get("item_details", []),
        )


class VoucherVaultApiClient:
    """Client to interact with VoucherVault."""

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        api_token: str,
    ) -> None:
        """Initialize the client."""

        self.host = host
        self.port = port
        self.url = f"http://{host}:{port}"
        self.username = username
        self.password = password
        self.api_token = api_token

    async def test_connection(self) -> bool:
        """Test the connection to the API using the provided credentials."""
        token_valid = await self.authenticate_token()
        basic_valid = await self.authenticate_basic()
        return token_valid and basic_valid

    async def authenticate_token(self) -> bool:
        """Verify the token is valid by fetching statistics from the API."""
        _LOGGER.debug("Authenticating with API token to verify access")
        stats = await self.get_stats()
        if stats is None:
            _LOGGER.error("API token authentication failed")
            return False
        _LOGGER.debug("API token authentication successful")
        return True

    async def authenticate_basic(self) -> bool:
        """Verify the username and password are valid by performing a login action to obtain a session cookie."""
        _LOGGER.debug(
            "Authenticating with basic credentials to verify username and password"
        )
        session = await self.login_and_get_session()
        if session is None:
            _LOGGER.error(
                "Basic authentication failed with provided username and password"
            )
            return False
        await session.close()
        _LOGGER.debug(
            "Basic authentication successful with provided username and password"
        )
        return True

    async def login_and_get_session(self) -> aiohttp.ClientSession | None:
        """Perform the login action to obtain a session cookie for future authenticated requests."""
        _LOGGER.debug("Performing login action to obtain session cookie")

        # Create a new session with a cookie jar to store cookies across requests
        connector = aiohttp.TCPConnector(force_close=True)
        jar = aiohttp.CookieJar(unsafe=True)
        session = aiohttp.ClientSession(connector=connector, cookie_jar=jar)
        login_url = f"{self.url}/en/accounts/login/"

        try:
            # First, access the login page to get the CSRF token cookie
            async with session.get(login_url) as resp:
                if resp.status != 200:
                    await session.close()
                    _LOGGER.error(
                        "Failed to access login page, status code: %s", resp.status
                    )
                    return None
                _LOGGER.debug(
                    "Login page accessed successfully, now submitting credentials"
                )

            # Extract the CSRF token from the cookie jar
            csrf_token = jar.filter_cookies(login_url).get("csrftoken")
            if not csrf_token:
                await session.close()
                _LOGGER.error("CSRF token not found in login response cookies")
                return None

            payload = {
                "username": self.username,
                "password": self.password,
                "csrfmiddlewaretoken": csrf_token.value,
            }

            headers = {
                "Referer": login_url,
            }

            # Submit the login form with credentials and CSRF token
            async with session.post(
                login_url, data=payload, headers=headers, allow_redirects=False
            ) as resp:
                if resp.status != 302:
                    await session.close()
                    _LOGGER.error(
                        "Login failed, expected redirect but got status %s", resp.status
                    )
                    return None
                _LOGGER.debug("Login successful, session cookie obtained")
        except aiohttp.ClientError as e:
            await session.close()
            _LOGGER.error("Login request failed: %s", e)
            return None

        return session

    async def send_api_request(
        self, request_type: str, endpoint: str, data=None
    ) -> dict | list | None:
        """Helper method to perform requests to the API.

        Request type can be GET, POST, PATCH, DELETE.
        """
        _LOGGER.debug("Sending API request: %s %s", request_type, endpoint)
        url = f"{self.url}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
        }

        session = aiohttp.ClientSession()
        try:
            async with session.request(
                request_type, url, headers=headers, json=data
            ) as response:
                if response.status in (200, 201):
                    try:
                        return await response.json()
                    except aiohttp.ContentTypeError:
                        return None
                else:
                    _LOGGER.error(
                        "API request failed: %s %s - Status: %s",
                        request_type,
                        url,
                        response.status,
                    )
                    return None
        except aiohttp.ClientError as e:
            _LOGGER.error("API request error: %s", e)
            return None
        finally:
            await session.close()

    async def get_stats(
        self,
    ) -> ApiData:
        """Fetch global stats from the API.

        Example curl:
        curl -H "Authorization: Bearer <API-TOKEN>" http://127.0.0.1:8000/en/api/get/stats
        """
        raw_data = await self.send_api_request("GET", "/en/api/get/stats")
        if raw_data is None:
            return ApiData()
        return ApiData.from_api_response(raw_data)

    # async def get_vouchers(self) -> list[dict]:
    #     """Fetch all vouchers."""
    #     return await self.get_stats()["item_details"]

    # async def get_coupons(self) -> list[dict]:
    #     """Fetch all coupons."""

    # async def get_gift_cards(self) -> list[dict]:
    #     """Fetch all gift cards."""

    # async def get_loyalty_cards(self) -> list[dict]:
    #     """Fetch all loyalty cards."""

    # # ------------------------------------------------------------------ #
    # # POST / PATCH / DELETE  (if needed)
    # # ------------------------------------------------------------------ #

    # async def redeem_voucher(self, voucher_id: int) -> bool:
    #     """Mark a voucher as redeemed."""

    # async def add_transaction(self, gift_card_id: int, amount: float) -> bool:
    #     """Log a transaction against a gift card."""
