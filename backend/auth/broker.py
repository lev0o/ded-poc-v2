import os, msal, struct
from typing import List
from backend.settings import settings

AUTHORITY = f"https://login.microsoftonline.com/{settings.tenant_id}"

# Fabric delegated scopes (per MS quickstart)
FABRIC_SCOPES = [
    "https://api.fabric.microsoft.com/Workspace.Read.All",
    "https://api.fabric.microsoft.com/Item.Read.All",
]

# MUST be single slash:
SQL_SCOPE = "https://database.windows.net/.default"

class TokenBroker:
    def __init__(self, cache_path: str):
        self.cache = msal.SerializableTokenCache()
        if os.path.exists(cache_path):
            self.cache.deserialize(open(cache_path, "r").read())
        self.app = msal.PublicClientApplication(
            client_id=settings.client_id,
            authority=AUTHORITY,
            token_cache=self.cache,
        )

    def _persist(self):
        if self.cache.has_state_changed:
            with open(settings.token_cache_path, "w") as f:
                f.write(self.cache.serialize())

    def token(self, scopes: List[str]) -> str:
        accounts = self.app.get_accounts()
        acct = accounts[0] if accounts else None
        result = self.app.acquire_token_silent(scopes, account=acct)
        if not result:
            flow = self.app.initiate_device_flow(scopes=scopes)
            if "user_code" not in flow:
                raise RuntimeError("Device code flow init failed")
            # This prints ONCE in the server logs on first use
            print(flow["message"])
            result = self.app.acquire_token_by_device_flow(flow)
        if "access_token" not in result:
            raise RuntimeError(f"Auth failed for scopes {scopes}: {result}")
        self._persist()
        return result["access_token"]

broker = TokenBroker(settings.token_cache_path)

def sql_access_token_buffer() -> bytes:
    """
    msodbcsql expects a UTF-16-LE access token prefixed by a 4-byte little-endian length.
    """
    token = broker.token([SQL_SCOPE])              # raw JWT string
    tb = token.encode("utf-16-le")                 # UTF-16-LE
    return struct.pack("<I", len(tb)) + tb         # length prefix + bytes