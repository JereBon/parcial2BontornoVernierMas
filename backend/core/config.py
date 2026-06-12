from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/parcial_db"
    JWT_SECRET: str = "CHANGE_ME_IN_PROD_super_secret_key_32_chars_min"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    BCRYPT_ROUNDS: int = 12
    COOKIE_NAME: str = "access_token"
    REFRESH_COOKIE_NAME: str = "refresh_token"
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]
    # Mercado Pago
    MP_ACCESS_TOKEN: str = ""
    MP_PUBLIC_KEY: str = ""
    MP_SANDBOX: bool = True
    MP_STORE_URL: str = "http://localhost:5174"
    MP_WEBHOOK_URL: str = ""
    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    # Rate limiting
    RATE_LIMIT_DEFAULT_BURST: int = 60
    RATE_LIMIT_DEFAULT_PER_MINUTE: float = 300.0
    RATE_LIMIT_AUTH_BURST: int = 5
    RATE_LIMIT_AUTH_PER_MINUTE: float = 0.333  # 5 intentos / 15 min

    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")


settings = Settings()
