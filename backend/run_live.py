"""Start the Medora backend (Supabase/Qdrant if configured, otherwise local SQLite mode)."""
from medora.config import Settings
import uvicorn

if __name__ == "__main__":
    settings = Settings()
    if settings.supabase_enabled:
        print("[Medora] Starting in Supabase Cloud mode on http://127.0.0.1:8000")
    else:
        print("[Medora] Starting in Local SQLite mode (Supabase unconfigured or offline) on http://127.0.0.1:8000")
        print(f"[Medora] Demo accounts enabled: {settings.demo_accounts_enabled}")
    uvicorn.run("medora.app:app", host="127.0.0.1", port=8000)
