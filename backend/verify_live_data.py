"""Read-only verification through the frontend proxy using public sample accounts."""
import asyncio
import json

import httpx

from medora.practice_catalog import MODULES
from seed_live_data import key


async def main():
    base = "http://localhost:5173/api/v1"
    report, practices = {}, {}
    async with httpx.AsyncClient(base_url=base, headers={"Origin": "http://localhost:5173"}, timeout=30) as anonymous:
        response = await anonymous.get("/practice/bootstrap")
        assert response.status_code == 401, "Anonymous practice access must be rejected"
        capabilities = (await anonymous.get("/capabilities")).json()
        assert capabilities["mode"] == "supabase" and capabilities["semantic_search"]
        report["anonymous_denied"] = True
        report["backend"] = capabilities["mode"]
    for role in ["doctor", "hospital"]:
        async with httpx.AsyncClient(base_url=base, headers={"Origin": "http://localhost:5173"}, timeout=30) as client:
            login = await client.post("/auth/login", json={"email": role + "@medora.demo", "password": "Medora123!"})
            assert login.status_code == 200, f"{role} Supabase login failed"
            bootstrap = await client.get("/practice/bootstrap")
            assert bootstrap.status_code == 200, f"{role} bootstrap failed"
            practice = bootstrap.json()["practice_id"]
            practices[role] = practice
            assert len(bootstrap.json()["modules"]) == 18
            for module in MODULES:
                response = await client.get("/practice/records/" + module)
                assert response.status_code == 200, f"{role} {module} read failed"
                assert any(r["id"] == key(practice, module) for r in response.json()["items"]), f"{role} {module} sample missing"
            for path in ["/practice/summary", "/practice/finance", f"/practice/patient/{key(practice, 'patients')}/timeline", f"/practice/record/{key(practice, 'emr')}/history"]:
                assert (await client.get(path)).status_code == 200, "Related workflow read failed"
            if role == "hospital":
                denied = await client.get("/practice/bootstrap", params={"practice_id": practices["doctor"]})
                assert denied.status_code == 403, "Cross-practice access must be rejected"
                hidden = await client.get("/practice/record/" + key(practices["doctor"], "patients"))
                assert hidden.status_code == 404, "Cross-practice records must remain hidden"
                report["cross_practice_denied"] = True
            report[role] = {"supabase_login": True, "modules_loaded": 18, "summary_finance_timeline_audit": True}
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
