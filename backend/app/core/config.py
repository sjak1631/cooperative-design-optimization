from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # App
    APP_TITLE: str = "CoopDesignBO API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # 12 hours

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./study.db"

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:80"]

    # BO
    BO_BATCH_SIZE: int = 8
    BO_NUM_RESTARTS: int = 10
    BO_RAW_SAMPLES: int = 512

    # Study
    SESSION_TIMEOUT_MINUTES: int = 20
    PARETO_FRONT_TARGET: int = 3
    LLM_MIN_FORMAL_EVALS: int = 5  # formal evals required before LLM is unlocked

    # Task config
    TASKS_CONFIG_PATH: str = "app/tasks/config.yaml"

    # Guest login
    GUEST_LOGIN_ENABLED: bool = False
    GUEST_TASK_ID: str = "task_sns"  # Task assigned to guest users


@lru_cache
def get_settings() -> Settings:
    return Settings()
