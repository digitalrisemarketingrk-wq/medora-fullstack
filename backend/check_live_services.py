"""Read-only connectivity/schema checks; never prints credentials or patient data."""
import asyncio
import json

import httpx

from medora.config import Settings
from medora.providers import supabase_headers


async def main():
    s = Settings()
    report = {"supabase_configured": s.supabase_enabled, "qdrant_configured": s.rag_enabled,
              "app_env": s.app_env, "demo_accounts_enabled": s.demo_accounts_enabled,
              "embedding_dimensions": s.embedding_dimensions}
    async with httpx.AsyncClient(timeout=20) as client:
        async def table(name, select="id"):
            try:
                r = await client.get(s.supabase_url.rstrip('/')+'/rest/v1/'+name,
                    params={"select": select, "limit": "1"}, headers=supabase_headers(s.supabase_secret_key.get_secret_value()))
                return {"status": r.status_code, "error_code": r.json().get('code') if isinstance(r.json(), dict) else None}
            except Exception as error:
                return {"error": type(error).__name__}
        checks = {
            "profiles": ("medora_profiles", "id"), "workspaces": ("medora_workspaces", "owner_id"),
            "practice_records": ("medora_practice_records", "id"), "practice_members": ("medora_practice_members", "user_id"),
            "practice_events": ("medora_practice_events", "id"), "grant_expiry": ("medora_access_grants", "expires_at"),
        }
        results = await asyncio.gather(*(table(*v) for v in checks.values()))
        report["supabase_schema"] = dict(zip(checks, results))
        try:
            r = await client.get(s.qdrant_url.rstrip('/')+'/collections/'+s.qdrant_collection,
                headers={"api-key": s.qdrant_api_key.get_secret_value()})
            result = r.json().get('result', {})
            report["qdrant"] = {"status": r.status_code, "vectors": result.get('config', {}).get('params', {}).get('vectors'), "point_count": result.get('points_count')}
        except Exception as error:
            report["qdrant"] = {"error": type(error).__name__}
        try:
            r = await client.get(s.supabase_url.rstrip('/')+'/rest/v1/medora_profiles',
                params={"select": "role,email", "limit": "100"}, headers=supabase_headers(s.supabase_secret_key.get_secret_value()))
            if r.status_code == 200:
                rows = r.json()
                report["accounts"] = {"roles": {role: sum(p['role'] == role for p in rows) for role in ['patient','doctor','hospital']},
                    "existing_sample_accounts": [p['email'] for p in rows if p['email'].endswith('@medora.demo')]}
        except Exception:
            pass
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    asyncio.run(main())
