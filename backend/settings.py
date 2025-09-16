# fabric_explorer/settings.py
from pydantic import Field, AnyUrl
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # AAD / MSAL
    tenant_id: str = Field(..., alias="TENANT_ID")
    client_id: str = Field(..., alias="CLIENT_ID")
    token_cache_path: str = Field(".token_cache.json", alias="TOKEN_CACHE_PATH")

    # Microsoft Fabric / Power BI
    fabric_base: AnyUrl = Field("https://api.fabric.microsoft.com/v1/", alias="FABRIC_BASE")
    pbi_base: AnyUrl = Field("https://api.powerbi.com/v1.0/myorg/", alias="PBI_BASE")
    
    # Fabric HTTP client settings
    fabric_http_timeout: int = Field(45, alias="FABRIC_HTTP_TIMEOUT", description="Seconds")
    fabric_http_retries: int = Field(3, alias="FABRIC_HTTP_RETRIES", description="Max retry attempts on transient HTTP errors")

    # Catalog DB
    catalog_db_url: str = Field("sqlite+aiosqlite:///./catalog.db", alias="CATALOG_DB_URL")
    
    # Backend HTTP base URL for agent tools
    backend_base: str = Field("http://127.0.0.1:8000", alias="BACKEND_BASE")

    # Azure OpenAI
    azure_openai_api_key: str = Field(..., alias="AZURE_OPENAI_API_KEY")
    # NOTE: base resource URL (no `/openai/v1/` suffix)
    azure_openai_endpoint_base: AnyUrl = Field(..., alias="AZURE_OPENAI_ENDPOINT_BASE")
    azure_openai_api_version: str = Field("2024-08-01-preview", alias="AZURE_OPENAI_API_VERSION")
    azure_openai_deployment: str = Field("gpt-4.1", alias="AZURE_OPENAI_DEPLOYMENT")

    # pydantic-settings v2 config
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        populate_by_name=True,  # allow aliases to load
        extra="ignore",
    )

settings = Settings()
