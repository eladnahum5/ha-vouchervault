"""VoucherVault API client."""

from __future__ import annotations

import aiohttp


class VoucherVaultApiClient:
    """Client to interact with VoucherVault."""

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        api_token: str,
        session: aiohttp.ClientSession,
    ) -> None:
        """Initialize the client."""

        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.api_token = api_token
        self.session = session

    async def authenticate_token(self) -> bool:
        """Verify the token is valid by fetching statistics from the API."""
        stats = await self.get_stats()
        return stats is not None

    async def send_api_request(
        self, request_type: str, method: str, endpoint: str, data=None
    ) -> dict | list | None:
        """Helper method to perform requests to the API.

        Request type can be GET, POST, PATCH, DELETE.
        If method == token, use the API token for authentication.
        If method == basic, use basic auth with username and password.
        """
        url = f"http://{self.host}:{self.port}{endpoint}"
        headers = {}
        auth = None

        if method == "token":
            headers["Authorization"] = f"Bearer {self.api_token}"
        elif method == "basic":
            auth = aiohttp.BasicAuth(self.username, self.password)
        else:
            raise ValueError("Invalid authentication method")

        async with self.session.request(
            request_type, url, headers=headers, auth=auth, json=data
        ) as response:
            if response.status in (200, 201):
                try:
                    return await response.json()
                except aiohttp.ContentTypeError:
                    return None
            return None

    async def get_stats(self) -> dict:
        """Fetch global stats from the API.

        Example curl:
        curl -H "Authorization: Bearer <API-TOKEN>" http://127.0.0.1:8000/en/api/get/stats
        """
        return await self.send_api_request("GET", "token", "/en/api/get/stats")

    async def get_vouchers(self) -> list[dict]:
        """Fetch all vouchers."""

    async def get_coupons(self) -> list[dict]:
        """Fetch all coupons."""

    async def get_gift_cards(self) -> list[dict]:
        """Fetch all gift cards."""

    async def get_loyalty_cards(self) -> list[dict]:
        """Fetch all loyalty cards."""

    # ------------------------------------------------------------------ #
    # POST / PATCH / DELETE  (if needed)
    # ------------------------------------------------------------------ #

    async def redeem_voucher(self, voucher_id: int) -> bool:
        """Mark a voucher as redeemed."""

    async def add_transaction(self, gift_card_id: int, amount: float) -> bool:
        """Log a transaction against a gift card."""
