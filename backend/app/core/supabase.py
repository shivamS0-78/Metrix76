"""
Centralized Supabase Database & Storage Client Provider
"""
from supabase import create_client, Client
from app.config import settings

_supabase_client: Client = None


def get_supabase_client() -> Client:
    global _supabase_client
    if _supabase_client is None:
        url = settings.SUPABASE_URL
        key = settings.SUPABASE_SERVICE_ROLE_KEY

        if not url or not key:
            print("[Supabase] Configuration notice: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env")
            return None

        try:
            _supabase_client = create_client(url, key)
            print(f"[Supabase] Connected to database: {url}")
        except Exception as e:
            print(f"[Supabase] Connection error: {e}")
            _supabase_client = None

    return _supabase_client
