from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    oimo_env: str = "dev"
    oimo_jwt_secret: str = "change-me"
    api_prefix: str = "/api/v1"

    database_url: str
    redis_url: str
    celery_broker_url: str
    celery_result_backend: str

    s3_endpoint_url: str
    s3_access_key: str
    s3_secret_key: str
    s3_bucket: str
    s3_region: str = "us-east-1"
    s3_presign_ttl: int = 3600

    comfyui_url: str = "http://127.0.0.1:8188"
    comfyui_timeout: int = 180

    xai_api_key: str | None = None
    replicate_api_token: str | None = None
    ohapi_fallback_url: str | None = None
    ohapi_fallback_key: str | None = None

    max_selfies_per_character: int = 5
    default_rate_limit: str = "30/minute"


settings = Settings()
