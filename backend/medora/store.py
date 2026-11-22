import copy
import hashlib
import hmac
import io
import json
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from datetime import date

import httpx
import qrcode
import qrcode.image.svg
from fastapi import HTTPException

from .config import Settings
from .models import Profile
from .providers import supabase_headers


def empty_workspace(profile: Profile) -> dict:
    today = date.today().isoformat()
    data = {k: [] for k in ["appointments", "patients", "tasks", "documents", "medicines", "family", "notes", "messages", "access", "audit", "waiting", "programmes"]}
    data["team"] = {}
    data["features"] = {"carePreferences": {"area": "", "funding": "All care types", "language": "Any language", "accessible": False, "availability": "Any availability", "urgency": "Any urgency", "savedProviders": []}, "medicationPlans": {}, "familyCare": {}, "visitAgendas": {}, "savedSummaries": [], "documentQuestions": {}, "documentShares": [], "clinicalDrafts": {}}
    data["settings"] = {"name": profile.name, "location": "", "blood": "", "language": "English", "largeText": False, "highContrast": False, "readAloud": False, "simple": False, "notifications": True, "treatment": False, "sharing": False, "research": False}
    if profile.role == "patient":
        data["patients"] = [{"id": "p1", "name": profile.name, "age": 0, "initials": "".join(w[0] for w in profile.name.split())[:2].upper(), "condition": "", "lastVisit": today, "email": profile.email, "risk": "Not assessed"}]
    return data


class Store:
    def __init__(self, settings: Settings, client: httpx.AsyncClient):
        self.s = settings
        self.client = client
        if not settings.supabase_enabled:
            settings.data_dir.mkdir(parents=True, exist_ok=True)
            self.path = settings.data_dir / "medora.sqlite3"
            with self.db() as db:
                db.executescript("""
                CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, role TEXT, password TEXT);
                CREATE TABLE IF NOT EXISTS workspaces (owner_id TEXT PRIMARY KEY, data TEXT, version INTEGER);
                CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT, expires INTEGER);
                CREATE TABLE IF NOT EXISTS grants (owner_id TEXT, recipient_id TEXT, scope TEXT, PRIMARY KEY(owner_id,recipient_id));
                CREATE TABLE IF NOT EXISTS qr_receipts (token_hash TEXT,owner_id TEXT,recipient_id TEXT,expires_at INTEGER,revoked INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(token_hash,recipient_id));
                """)
                if "expires_at" not in [r[1] for r in db.execute("PRAGMA table_info(grants)")]:
                    db.execute("ALTER TABLE grants ADD COLUMN expires_at INTEGER")
            if settings.demo_accounts_enabled:
                try:
                    from seed_patients import get_complete_seed
                    seed_data = get_complete_seed()
                except Exception:
                    seed_data = None

                for role, name in [("patient", "Rahul Sharma"), ("doctor", "Dr. Rajesh Sharma"), ("hospital", "Apollo City Clinic")]:
                    p = self.local_profile(email=f"{role}@medora.demo")
                    if not p:
                        self.local_signup(f"{role}@medora.demo", "Medora123!", name, role)
                        p = self.local_profile(email=f"{role}@medora.demo")
                    elif p.get("name") in {"Dr Sarah Khan", "Alex Morgan", "Riverside Medical Centre"}:
                        with self.db() as db:
                            db.execute("UPDATE profiles SET name = ? WHERE email = ?", (name, f"{role}@medora.demo"))

                    if seed_data and p:
                        with self.db() as db:
                            row = db.execute("SELECT data FROM workspaces WHERE owner_id=?", (p["id"],)).fetchone()
                            if row:
                                try:
                                    existing = json.loads(row["data"])
                                    if len(existing.get("patients", [])) < 5 or len(existing.get("notes", [])) < 5:
                                        ws_data = dict(seed_data)
                                        ws_settings = dict(seed_data["settings"])
                                        ws_settings["name"] = name
                                        ws_data["settings"] = ws_settings
                                        db.execute("UPDATE workspaces SET data=? WHERE owner_id=?", (json.dumps(ws_data), p["id"]))
                                except Exception:
                                    pass

    @contextmanager
    def db(self):
        connection = sqlite3.connect(self.path, timeout=15)
        connection.row_factory = sqlite3.Row
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    @staticmethod
    def password_hash(password: str, salt: str | None = None):
        salt = salt or secrets.token_hex(16)
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
        return salt + ":" + digest

    def local_profile(self, *, email=None, id=None):
        with self.db() as db:
            row = db.execute("SELECT * FROM profiles WHERE email=?" if email else "SELECT * FROM profiles WHERE id=?", (email or id,)).fetchone()
        return dict(row) if row else None

    def local_signup(self, email, password, name, role="patient"):
        profile = Profile(id=str(uuid.uuid4()), email=email, name=name, role=role)
        try:
            with self.db() as db:
                db.execute("INSERT INTO profiles VALUES (?,?,?,?,?)", (profile.id, email, name, role, self.password_hash(password)))
                db.execute("INSERT INTO workspaces VALUES (?,?,0)", (profile.id, json.dumps(empty_workspace(profile))))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "An account with this email already exists") from None
        return profile

    async def remote(self, method: str, path: str, *, params=None, body=None, prefer="return=representation"):
        response = await self.client.request(method, self.s.supabase_url.rstrip("/") + "/rest/v1/" + path, params=params, json=body, headers={**supabase_headers(self.s.supabase_secret_key.get_secret_value()), "Prefer": prefer})
        if response.is_error:
            if path.startswith("medora_practice_") or path.startswith("rpc/medora_"):
                try:
                    code = response.json().get("code")
                except ValueError:
                    code = None
                if code in {"PGRST205", "PGRST202"}:
                    raise HTTPException(503, "Supabase practice setup is incomplete. Apply backend/migrations/002_practice.sql and 003_staff_permissions.sql in the Supabase SQL Editor.")
            raise HTTPException(503, "Database operation failed; check server configuration")
        return response.json() if response.content else []

    async def profile(self, id: str) -> Profile:
        if self.s.supabase_enabled:
            rows = await self.remote("GET", "medora_profiles", params={"id": "eq." + id, "limit": "1"})
            row = rows[0] if rows else None
        else:
            row = self.local_profile(id=id)
        if not row:
            raise HTTPException(403, "Account profile has not been provisioned")
        return Profile.model_validate(row)

    async def profile_by_email(self, email: str) -> Profile:
        if self.s.supabase_enabled:
            rows = await self.remote("GET", "medora_profiles", params={"email": "eq." + email.strip().lower(), "limit": "1"})
            row = rows[0] if rows else None
        else:
            row = self.local_profile(email=email.strip().lower())
        if not row:
            raise HTTPException(404, "No registered recipient with that email")
        return Profile.model_validate(row)

    def local_session(self, user_id):
        token = secrets.token_urlsafe(48)
        with self.db() as db:
            db.execute("DELETE FROM sessions WHERE expires < ?", (int(time.time()),))
            db.execute("INSERT INTO sessions VALUES (?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), user_id, int(time.time()) + self.s.session_seconds))
        return token

    async def session_profile(self, token: str) -> Profile:
        if self.s.supabase_enabled:
            response = await self.client.get(self.s.supabase_url.rstrip("/") + "/auth/v1/user", headers={"apikey": self.s.supabase_publishable_key.get_secret_value(), "Authorization": "Bearer " + token})
            if response.is_error or not response.json().get("id"):
                raise HTTPException(401, "Session expired; sign in again")
            return await self.profile(response.json()["id"])
        with self.db() as db:
            row = db.execute("SELECT user_id FROM sessions WHERE token_hash=? AND expires>?", (hashlib.sha256(token.encode()).hexdigest(), int(time.time()))).fetchone()
        if not row:
            raise HTTPException(401, "Session expired; sign in again")
        return await self.profile(row["user_id"])

    async def authorize(self, actor: Profile, owner: str, write=False):
        if actor.id == owner:
            return "write"
        # Browsers cannot assert roles; professional roles come from profiles.
        if actor.role not in ["doctor", "hospital"]:
            raise HTTPException(403, "This record belongs to another account")
        if self.s.supabase_enabled:
            rows = await self.remote("GET", "medora_access_grants", params={"owner_id": "eq." + owner, "recipient_id": "eq." + actor.id, "limit": "1"})
            grant = rows[0] if rows else None
            scope = grant["scope"] if grant and (not grant.get("expires_at") or grant["expires_at"] > int(time.time())) else None
        else:
            with self.db() as db:
                row = db.execute("SELECT scope FROM grants WHERE owner_id=? AND recipient_id=? AND (expires_at IS NULL OR expires_at>?)", (owner, actor.id, int(time.time()))).fetchone()
            scope = row["scope"] if row else None
        if not scope or (write and scope != "write"):
            raise HTTPException(403, "The patient has not granted the required record access")
        return scope

    async def workspace(self, owner: str):
        if self.s.supabase_enabled:
            rows = await self.remote("GET", "medora_workspaces", params={"owner_id": "eq." + owner, "limit": "1"})
            if not rows:
                profile = await self.profile(owner)
                initial = empty_workspace(profile)
                try:
                    rows = await self.remote("POST", "medora_workspaces", body={"owner_id": owner, "data": initial, "version": 0})
                except HTTPException:
                    rows = await self.remote("GET", "medora_workspaces", params={"owner_id": "eq." + owner, "limit": "1"})
            if not rows:
                raise HTTPException(503, "Workspace initialization failed")
            return {"owner_id": owner, "data": rows[0]["data"], "version": rows[0]["version"]}
        with self.db() as db:
            row = db.execute("SELECT * FROM workspaces WHERE owner_id=?", (owner,)).fetchone()
        if not row:
            raise HTTPException(404, "Workspace not found")
        return {"owner_id": owner, "data": json.loads(row["data"]), "version": row["version"]}

    async def save(self, owner: str, data: dict, version: int):
        if self.s.supabase_enabled:
            rows = await self.remote("PATCH", "medora_workspaces", params={"owner_id": "eq." + owner, "version": "eq." + str(version)}, body={"data": data, "version": version + 1})
            if not rows:
                raise HTTPException(409, "Records changed in another session; reload before editing")
        else:
            with self.db() as db:
                changed = db.execute("UPDATE workspaces SET data=?, version=version+1 WHERE owner_id=? AND version=?", (json.dumps(data), owner, version)).rowcount
            if not changed:
                raise HTTPException(409, "Records changed in another session; reload before editing")
        return {"owner_id": owner, "data": data, "version": version + 1}

    async def grants(self, actor: Profile):
        if self.s.supabase_enabled:
            sent = await self.remote("GET", "medora_access_grants", params={"owner_id": "eq." + actor.id})
            received = await self.remote("GET", "medora_access_grants", params={"recipient_id": "eq." + actor.id})
        else:
            with self.db() as db:
                sent = [dict(r) for r in db.execute("SELECT * FROM grants WHERE owner_id=?", (actor.id,))]
                received = [dict(r) for r in db.execute("SELECT * FROM grants WHERE recipient_id=?", (actor.id,))]
        result = {"sent": [], "received": []}
        for row in sent:
            recipient = await self.profile(row["recipient_id"])
            result["sent"].append({**row, "name": recipient.name, "email": recipient.email})
        for row in received:
            owner = await self.profile(row["owner_id"])
            result["received"].append({**row, "name": owner.name, "email": owner.email})
        return result

    async def grant(self, owner: Profile, email: str, scope: str, expires_at: int | None = None):
        recipient = await self.profile_by_email(email)
        if recipient.role not in ["doctor", "hospital"] or recipient.id == owner.id:
            raise HTTPException(400, "Choose a registered doctor or hospital account")
        row = {"owner_id": owner.id, "recipient_id": recipient.id, "scope": scope, "expires_at": expires_at}
        if self.s.supabase_enabled:
            if expires_at:
                existing = await self.remote("GET", "medora_access_grants", params={"owner_id": "eq." + owner.id, "recipient_id": "eq." + recipient.id, "limit": "1"})
                if existing and existing[0].get("expires_at") is None:
                    return existing[0]
            await self.remote("POST", "medora_access_grants", params={"on_conflict":"owner_id,recipient_id"}, body=row, prefer="return=representation,resolution=merge-duplicates")
        else:
            with self.db() as db:
                existing = db.execute("SELECT scope,expires_at FROM grants WHERE owner_id=? AND recipient_id=?", (owner.id, recipient.id)).fetchone()
                if expires_at and existing and existing["expires_at"] is None:
                    return {"owner_id": owner.id, "recipient_id": recipient.id, "scope": existing["scope"], "expires_at": None}
                db.execute("INSERT OR REPLACE INTO grants (owner_id,recipient_id,scope,expires_at) VALUES (?,?,?,?)", (owner.id, recipient.id, scope, expires_at))
        return row

    async def revoke(self, owner: str, recipient: str):
        if self.s.supabase_enabled:
            await self.remote("POST", "rpc/medora_revoke_care_access", body={"p_owner": owner, "p_recipient": recipient})
        else:
            with self.db() as db:
                db.execute("UPDATE qr_receipts SET revoked=1 WHERE owner_id=? AND recipient_id=?", (owner, recipient))
                db.execute("DELETE FROM grants WHERE owner_id=? AND recipient_id=?", (owner, recipient))

    async def grant_qr_access(self, token: str, owner: str, recipient: str, expires_at: int):
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        if self.s.supabase_enabled:
            result = await self.remote("POST", "rpc/medora_grant_qr_access", body={"p_hash": token_hash, "p_owner": owner, "p_recipient": recipient, "p_expires": expires_at})
            if isinstance(result, dict) and result.get("error"):
                raise HTTPException(403, result["error"])
        else:
            with self.db() as db:
                db.execute("BEGIN IMMEDIATE")
                row = db.execute("SELECT revoked FROM qr_receipts WHERE token_hash=? AND recipient_id=?", (token_hash, recipient)).fetchone()
                if row and row["revoked"]:
                    raise HTTPException(403, "This pass was revoked for your account. Ask the patient for a new pass.")
                db.execute("INSERT OR IGNORE INTO qr_receipts VALUES (?,?,?,?,0)", (token_hash, owner, recipient, expires_at))
                previous = db.execute("SELECT scope,expires_at FROM grants WHERE owner_id=? AND recipient_id=?", (owner, recipient)).fetchone()
                if not previous or previous["expires_at"] is not None:
                    db.execute("INSERT OR REPLACE INTO grants (owner_id,recipient_id,scope,expires_at) VALUES (?,?,?,?)", (owner, recipient, "read", max(expires_at, previous["expires_at"] or 0) if previous else expires_at))

    async def all_profiles(self) -> list[Profile]:
        if self.s.supabase_enabled:
            rows = await self.remote("GET", "medora_profiles", params={"select": "*"})
        else:
            with self.db() as db:
                rows = [dict(r) for r in db.execute("SELECT id, email, name, role FROM profiles")]
        return [Profile.model_validate(r) for r in rows]

    def sign_qr_pass(self, patient_id: str, access_type: str = "temporary", ttl_seconds: int = 900) -> tuple[str, int, str]:
        if access_type == "lifetime":
            raise HTTPException(422, "Use an explicit care-access grant for ongoing access. QR passes are temporary.")
        expires_at = int(time.time()) + ttl_seconds
        nonce = secrets.token_hex(8)
        payload = f"{patient_id}:{expires_at}:{access_type}:{nonce}"
        secret = self.s.supabase_secret_key.get_secret_value().encode() if self.s.supabase_secret_key else b"medora-local-secret-key-32b"
        sig = hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()[:32]
        token = f"{patient_id}.{expires_at}.{access_type}.{nonce}.{sig}"
        return token, expires_at, access_type

    def verify_qr_pass(self, token: str) -> tuple[str, int, str]:
        parts = token.strip().split(".")
        if len(parts) == 5:
            patient_id, expires_str, access_type, nonce, sig = parts
            payload = f"{patient_id}:{expires_str}:{access_type}:{nonce}"
        elif len(parts) == 4:
            patient_id, expires_str, access_type, sig = parts
            if access_type not in ["temporary", "lifetime"]:
                access_type = "temporary"
            payload = f"{patient_id}:{expires_str}:{access_type}"
        elif len(parts) == 3:
            patient_id, expires_str, sig = parts
            access_type = "temporary"
            payload = f"{patient_id}:{expires_str}"
        else:
            raise HTTPException(400, "Invalid QR pass token format")
        if access_type != "temporary":
            raise HTTPException(403, "This access mode is no longer supported. Ask the patient for a temporary pass.")
        try:
            expires_at = int(expires_str)
        except ValueError:
            raise HTTPException(400, "Invalid QR pass expiration timestamp")
        if time.time() > expires_at:
            raise HTTPException(410, "This QR pass has expired. Ask the patient to generate a new pass.")
        secret = self.s.supabase_secret_key.get_secret_value().encode() if self.s.supabase_secret_key else b"medora-local-secret-key-32b"
        expected_sig = hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()[:32]
        if not hmac.compare_digest(sig, expected_sig):
            raise HTTPException(403, "Invalid QR pass signature")
        return patient_id, expires_at, access_type

    @staticmethod
    def generate_qr_svg(content: str) -> str:
        factory = qrcode.image.svg.SvgPathImage
        qr = qrcode.QRCode(box_size=10, border=2, image_factory=factory)
        qr.add_data(content)
        qr.make(fit=True)
        img = qr.make_image()
        stream = io.BytesIO()
        img.save(stream)
        return stream.getvalue().decode("utf-8")

    async def ecosystem_sync(self, actor: Profile, owner_id: str, previous: dict, current: dict):
        """Keep patient, doctor, and hospital workspaces in sync for appointments, messages, and directory access."""
        try:
            profiles = await self.all_profiles()

            def find_profile(name_or_email: str, role: str | None = None) -> Profile | None:
                query = (name_or_email or "").strip().lower().replace(".", "")
                if not query:
                    return None
                for p in profiles:
                    if role and p.role != role:
                        continue
                    p_name = p.name.lower().replace(".", "")
                    if p.email.lower() == query or query in p_name or p_name in query:
                        return p
                if role == "doctor":
                    for p in profiles:
                        if p.role == "doctor" and any(k in query for k in ["sharma", "rajesh", "sarah", "khan"]):
                            return p
                if role == "hospital":
                    for p in profiles:
                        if p.role == "hospital" and any(k in query for k in ["apollo", "riverside", "clinic", "hospital"]):
                            return p
                return None

            # 1. Sync appointments to Doctor, Hospital, and Patient
            curr_appts = current.get("appointments", [])
            prev_appts = previous.get("appointments", [])
            curr_appt_ids = {a.get("id") for a in curr_appts if a.get("id")}
            deleted_ids = {a.get("id") for a in prev_appts if a.get("id") and a.get("id") not in curr_appt_ids}

            # Group targets: target_id -> {"role": role, "appts": [...], "deleted_ids": set(), "patients": [...]}
            target_groups = {}

            for appt in curr_appts:
                doc_prof = find_profile(appt.get("doctor", ""), "doctor")
                hosp_prof = find_profile(appt.get("provider", ""), "hospital")
                pat_prof = find_profile(appt.get("patient", ""), "patient")
                if not pat_prof and actor.role == "patient":
                    pat_prof = actor

                targets = []
                if doc_prof and doc_prof.id != owner_id:
                    targets.append((doc_prof.id, "doctor"))
                if hosp_prof and hosp_prof.id != owner_id:
                    targets.append((hosp_prof.id, "hospital"))
                if pat_prof and pat_prof.id != owner_id:
                    targets.append((pat_prof.id, "patient"))

                for tid, trole in targets:
                    grp = target_groups.setdefault(tid, {"role": trole, "appts": [], "deleted_ids": set(deleted_ids), "patients": []})
                    grp["appts"].append(appt)
                    if pat_prof:
                        grp["patients"].append(pat_prof)

            for target_id, grp in target_groups.items():
                try:
                    target_ws = await self.workspace(target_id)
                    t_data = target_ws["data"]
                    t_appts = t_data.setdefault("appointments", [])
                    t_del = grp["deleted_ids"]
                    if t_del:
                        t_appts[:] = [a for a in t_appts if a.get("id") not in t_del]

                    for appt in grp["appts"]:
                        appt_id = appt.get("id")
                        idx = next((i for i, a in enumerate(t_appts) if (appt_id and a.get("id") == appt_id) or (a.get("date") == appt.get("date") and a.get("time") == appt.get("time") and a.get("patient") == appt.get("patient"))), -1)
                        if idx >= 0:
                            t_appts[idx] = {**t_appts[idx], **appt}
                        else:
                            t_appts.append(appt)

                    if grp["role"] in ["doctor", "hospital"]:
                        t_patients = t_data.setdefault("patients", [])
                        for pat_prof in grp["patients"]:
                            if not any(p.get("name", "").lower() == pat_prof.name.lower() or p.get("email", "").lower() == pat_prof.email.lower() for p in t_patients):
                                initials = "".join(w[0] for w in pat_prof.name.split())[:2].upper() or "PT"
                                t_patients.append({
                                    "id": "p1" if pat_prof.email == "patient@medora.demo" else str(uuid.uuid4())[:8],
                                    "name": pat_prof.name,
                                    "age": 34,
                                    "initials": initials,
                                    "condition": "Consultation booking",
                                    "lastVisit": date.today().isoformat(),
                                    "email": pat_prof.email,
                                    "risk": "Low"
                                })
                    await self.save(target_id, t_data, target_ws["version"])
                except Exception:
                    pass

                # Directory/appointment synchronization never creates consent grants.

            # 2. Sync newly sent messages to Recipient
            prev_msg_ids = {m.get("id") for m in previous.get("messages", []) if m.get("id")}
            curr_msgs = current.get("messages", [])
            for msg in curr_msgs:
                msg_id = msg.get("id")
                if msg_id and msg_id not in prev_msg_ids:
                    to_name = msg.get("to", "")
                    recipient_prof = find_profile(to_name)
                    if recipient_prof and recipient_prof.id != owner_id:
                        try:
                            rec_ws = await self.workspace(recipient_prof.id)
                            r_data = rec_ws["data"]
                            r_msgs = r_data.setdefault("messages", [])
                            if not any(m.get("id") == msg_id for m in r_msgs):
                                r_msgs.insert(0, {
                                    "id": msg_id,
                                    "to": to_name,
                                    "body": msg.get("body", ""),
                                    "time": msg.get("time", date.today().isoformat()),
                                    "kind": msg.get("kind", "Care message")
                                })
                                await self.save(recipient_prof.id, r_data, rec_ws["version"])
                        except Exception:
                            pass

            # Registered patient membership is not permission to read their record.
        except Exception:
            pass


def guarded_change(previous: dict, incoming: dict, clinician=False):
    """File locations/analysis are authoritative; clients cannot forge uploads."""
    old_docs = {d["id"]: d for d in previous["documents"]}
    incoming_ids = {d["id"] for d in incoming["documents"]}
    for old in old_docs.values():
        if old.get("storagePath") and old["id"] not in incoming_ids:
            raise HTTPException(400, "Delete stored documents through the document endpoint")
    for doc in incoming["documents"]:
        if doc.get("storagePath") or old_docs.get(doc["id"], {}).get("storagePath"):
            if doc["id"] not in old_docs or doc != old_docs[doc["id"]]:
                raise HTTPException(400, "Stored document metadata must be updated through document endpoints")
    if clinician:
        for key in ["settings", "access", "family", "medicines", "patients", "team", "waiting", "programmes"]:
            if incoming[key] != previous[key]:
                raise HTTPException(403, "Care teams cannot modify patient identity, consent, or medication data")
    return copy.deepcopy(incoming)
