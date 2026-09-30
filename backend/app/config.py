import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Automatically load .env from backend directory or workspace root
for env_path in [
    Path(__file__).resolve().parent.parent.parent / ".env",
    Path(__file__).resolve().parent.parent / ".env",
    Path.cwd() / ".env",
    Path.cwd() / "backend" / ".env",
]:
    if env_path.exists():
        load_dotenv(env_path, override=True)


class Settings(BaseSettings):
    PROJECT_NAME: str = "NAWI OIML R 76 Type Approval Core Engine"
    API_V1_STR: str = "/api/v1"
    SUPABASE_URL: str = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    STORAGE_BUCKET_REPORTS: str = os.getenv("STORAGE_BUCKET_REPORTS", "generated-reports")
    STORAGE_BUCKET_MEDIA: str = os.getenv("STORAGE_BUCKET_MEDIA", "instruments-attachments")

    model_config = SettingsConfigDict(case_sensitive=True, extra="ignore")


settings = Settings()
