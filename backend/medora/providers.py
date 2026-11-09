import base64
import io
import json
import math
import threading
import uuid
from urllib.parse import quote

import httpx
from fastapi import HTTPException
from pypdf import PdfReader
from starlette.concurrency import run_in_threadpool

from .config import Settings


def supabase_headers(key: str) -> dict[str, str]:
    headers = {"apikey": key}
    if key.startswith("eyJ"):
        headers["Authorization"] = "Bearer " + key
    return headers


class Providers:
    def __init__(self, settings: Settings, client: httpx.AsyncClient):
        self.s, self.client = settings, client
        self._fastembed = None
        self._fastembed_lock = threading.Lock()

    def _get_fastembed(self):
        with self._fastembed_lock:
            if self._fastembed is None:
                from fastembed import TextEmbedding
                self._fastembed = TextEmbedding("BAAI/bge-small-en-v1.5")
        return self._fastembed

    async def groq(self, messages: list, *, model=None, json_output=False, allow_gemini_fallback=True):
        if not self.s.groq_api_key.get_secret_value():
            if allow_gemini_fallback and self.s.gemini_api_key.get_secret_value():
                return await self.gemini(messages, model=model, json_output=json_output, allow_groq_fallback=False)
            raise HTTPException(503, "AI is not configured. Add the Groq key on the backend.")

        primary_model = model or self.s.groq_model
        candidate_models = [primary_model]
        for fallback in ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]:
            if fallback not in candidate_models:
                candidate_models.append(fallback)

        for candidate in candidate_models:
            body = {"model": candidate, "messages": messages, "temperature": 0.2, "max_completion_tokens": 2200}
            if json_output:
                body["response_format"] = {"type": "json_object"}
            try:
                response = await self.client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": "Bearer " + self.s.groq_api_key.get_secret_value()},
                    json=body,
                    timeout=25.0
                )
                if response.status_code == 200:
                    result = response.json()["choices"][0]["message"]["content"]
                    return json.loads(result) if json_output else str(result)
                if response.status_code == 429:
                    # Rate limit or quota hit for this specific model, cascade to next candidate
                    continue
            except Exception:
                continue

        # If all Groq models hit rate limits or failed, fall back to Gemini
        if allow_gemini_fallback and self.s.gemini_api_key.get_secret_value():
            return await self.gemini(messages, json_output=json_output, allow_groq_fallback=False)

        raise HTTPException(503, "The AI provider is temporarily unavailable. Please try again.")

    async def gemini(self, messages: list, *, model=None, json_output=False, allow_groq_fallback=True):
        key = self.s.gemini_api_key.get_secret_value()
        if not key:
            if allow_groq_fallback:
                return await self.groq(messages, model=model, json_output=json_output, allow_gemini_fallback=False)
            raise HTTPException(503, "Gemini API key is not configured.")

        primary_model = model or self.s.gemini_model
        candidate_models = [primary_model]
        for fallback in ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.8-flash"]:
            if fallback not in candidate_models:
                candidate_models.append(fallback)

        contents = []
        system_instruction = None

        for m in messages:
            role = m.get("role")
            content = m.get("content", "")
            if role == "system":
                system_instruction = {"parts": [{"text": content}]}
            elif role == "user":
                contents.append({"role": "user", "parts": [{"text": content}]})
            elif role == "assistant":
                contents.append({"role": "model", "parts": [{"text": content}]})

        body = {"contents": contents}
        if system_instruction:
            body["systemInstruction"] = system_instruction
        if json_output:
            body["generationConfig"] = {"responseMimeType": "application/json"}

        for candidate in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{candidate}:generateContent?key={key}"
            try:
                response = await self.client.post(url, json=body, timeout=25.0)
                if response.status_code == 200:
                    cand = response.json().get("candidates", [])[0]
                    text = cand.get("content", {}).get("parts", [])[0].get("text", "")
                    return json.loads(text) if json_output else str(text)
                # If 429 quota or 404, try next Gemini candidate model
            except Exception:
                continue

        # If all Gemini models failed, fall back to Groq
        if allow_groq_fallback and self.s.groq_api_key.get_secret_value():
            return await self.groq(messages, json_output=json_output, allow_gemini_fallback=False)

        raise HTTPException(503, "The Gemini provider could not complete this request")

    async def ai(self, messages: list, *, provider="gemini", model=None, json_output=False):
        if provider == "gemini":
            try:
                return await self.gemini(messages, model=model, json_output=json_output, allow_groq_fallback=True)
            except Exception:
                return await self.groq(messages, model=model, json_output=json_output, allow_gemini_fallback=False)
        else:
            try:
                return await self.groq(messages, model=model, json_output=json_output, allow_gemini_fallback=True)
            except Exception:
                return await self.gemini(messages, model=model, json_output=json_output, allow_groq_fallback=False)


    async def gemini_tts(self, text: str, gender: str = "female") -> bytes | None:
        key = self.s.gemini_api_key.get_secret_value() if self.s.gemini_api_key else None
        if not key:
            return None
        voice_name = "Aoede" if gender == "female" else "Fenrir"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent?key={key}"
        body = {
            "contents": [{"parts": [{"text": text[:3000]}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {
                            "voiceName": voice_name
                        }
                    }
                }
            }
        }
        try:
            response = await self.client.post(url, json=body, timeout=25.0)
            if response.status_code == 200:
                data = response.json()
                cand = data.get("candidates", [{}])[0]
                parts = cand.get("content", {}).get("parts", [])
                for p in parts:
                    if "inlineData" in p and p["inlineData"].get("data"):
                        return base64.b64decode(p["inlineData"]["data"])
        except Exception:
            pass
        return None

    def object_url(self, path: str):
        return self.s.supabase_url.rstrip("/") + "/storage/v1/object/" + quote(self.s.supabase_storage_bucket, safe="") + "/" + quote(path, safe="/")

    async def upload(self, path: str, content: bytes, mime: str):
        if self.s.supabase_enabled:
            response = await self.client.post(self.object_url(path), headers={**supabase_headers(self.s.supabase_secret_key.get_secret_value()), "Content-Type": mime, "x-upsert": "false"}, content=content)
            if response.is_error:
                raise HTTPException(503, "Document upload failed; check the private storage bucket")
        else:
            destination = self.s.data_dir / "documents" / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(content)

    async def read(self, path: str):
        if self.s.supabase_enabled:
            response = await self.client.get(self.object_url(path), headers=supabase_headers(self.s.supabase_secret_key.get_secret_value()))
            if response.is_error:
                raise HTTPException(503, "The stored document could not be read")
            return response.content
        path = self.s.data_dir / "documents" / path
        if not path.is_file():
            raise HTTPException(404, "Stored file not found")
        return path.read_bytes()

    async def delete(self, path: str):
        if self.s.supabase_enabled:
            response = await self.client.delete(self.object_url(path), headers=supabase_headers(self.s.supabase_secret_key.get_secret_value()))
            if response.is_error and response.status_code != 404:
                raise HTTPException(503, "Document deletion failed; please retry")
        else:
            (self.s.data_dir / "documents" / path).unlink(missing_ok=True)

    async def signed_url(self, path: str):
        response = await self.client.post(self.object_url(path).replace("/storage/v1/object/", "/storage/v1/object/sign/"), headers=supabase_headers(self.s.supabase_secret_key.get_secret_value()), json={"expiresIn": self.s.signed_url_seconds})
        if response.is_error:
            raise HTTPException(503, "A temporary document link could not be created")
        relative = response.json().get("signedURL") or response.json().get("signedUrl")
        if not relative or not relative.startswith("/object/sign/"):
            raise HTTPException(503, "Storage returned an unexpected link")
        return self.s.supabase_url.rstrip("/") + "/storage/v1" + relative

    @staticmethod
    def file_type(filename: str, content: bytes):
        suffix = filename.rsplit(".", 1)[-1].lower()
        if suffix == "pdf" and content.startswith(b"%PDF-"):
            return "application/pdf"
        if suffix == "png" and content.startswith(b"\x89PNG\r\n\x1a\n"):
            return "image/png"
        if suffix in ["jpg", "jpeg"] and content.startswith(b"\xff\xd8\xff"):
            return "image/jpeg"
        if suffix == "txt" and b"\x00" not in content:
            try:
                content.decode("utf-8")
                return "text/plain"
            except UnicodeDecodeError:
                pass
        raise HTTPException(400, "Choose a valid PDF, PNG, JPEG or UTF-8 text file")

    async def extract(self, content: bytes, mime: str):
        if mime == "text/plain":
            return content.decode("utf-8")[:80000]
        if mime == "application/pdf":
            return await run_in_threadpool(self.extract_pdf, content)
        encoded = base64.b64encode(content).decode()
        text = await self.groq([{"role": "user", "content": [{"type": "text", "text": "Transcribe visible document text exactly. Preserve measurements and units. Mark unclear text [unclear]; do not interpret or invent content."}, {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{encoded}"}}]}], model=self.s.groq_vision_model)
        return text[:80000]

    @staticmethod
    def extract_pdf(content:bytes):
        try:
            reader = PdfReader(io.BytesIO(content))
            if reader.is_encrypted or len(reader.pages) > 60:
                raise HTTPException(400, "Use an unencrypted PDF with no more than 60 pages")
            parts, size = [], 0
            for page in reader.pages:
                text = (page.extract_text() or "")[:16000]
                parts.append(text)
                size += len(text)
                if size >= 80000:
                    break
            text = "\n".join(parts)[:80000].strip()
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(400, "The PDF could not be read. Use a readable, unencrypted document.") from None
        if not text:
            raise HTTPException(422, "This PDF needs OCR. Upload a clear image or a text-based PDF.")
        return text

    async def embeddings(self, texts: list[str]):
        if not self.s.rag_enabled:
            raise HTTPException(503, "Configure Qdrant on the backend")
        
        # 1. If remote embedding API key is configured, use the remote endpoint
        if self.s.embedding_api_key.get_secret_value():
            response = await self.client.post(self.s.embedding_base_url.rstrip("/") + "/embeddings", headers={"Authorization": "Bearer " + self.s.embedding_api_key.get_secret_value()}, json={"model": self.s.embedding_model, "input": texts})
            if response.is_error:
                raise HTTPException(503, "The embedding provider could not process this request")
            rows = sorted(response.json().get("data", []), key=lambda r: r.get("index", 0))
            vectors = [r.get("embedding", []) for r in rows]
            if len(vectors) != len(texts) or any(len(v) != self.s.embedding_dimensions or any(not isinstance(x, (int, float)) or not math.isfinite(x) for x in v) for v in vectors):
                raise HTTPException(503, "Embedding dimensions do not match the configured collection")
            return vectors

        # 2. Otherwise use local FastEmbed ONNX model (0 cost, fast, 384 dimensions)
        model = await run_in_threadpool(self._get_fastembed)
        if not model:
            raise HTTPException(503, "FastEmbed model could not be initialized")

        def _embed():
            return [[float(x) for x in v] for v in model.embed(texts)]

        vectors = await run_in_threadpool(_embed)
        if len(vectors) != len(texts) or any(len(v) != self.s.embedding_dimensions or any(not math.isfinite(x) for x in v) for v in vectors):
            raise HTTPException(503, "Embedding dimensions do not match the configured collection")
        return vectors

    async def qdrant(self, method: str, path: str, body=None, allow_missing=False):
        response = await self.client.request(method, self.s.qdrant_url.rstrip("/") + "/collections/" + quote(self.s.qdrant_collection, safe="") + path, json=body, headers={"api-key": self.s.qdrant_api_key.get_secret_value()})
        if allow_missing and response.status_code == 404:
            return None
        if response.is_error:
            raise HTTPException(503, "Document search is temporarily unavailable")
        return response.json().get("result")

    async def ensure_collection(self):
        existing = await self.qdrant("GET", "", allow_missing=True)
        if existing is None:
            try:
                await self.qdrant("PUT", "", {"vectors": {"size": self.s.embedding_dimensions, "distance": "Cosine"}})
            except HTTPException:
                # Another worker may have created it at the same time.
                await self.qdrant("GET", "")
        for field in ["owner_id", "document_id"]:
            await self.qdrant("PUT", "/index?wait=true", {"field_name": field, "field_schema": "keyword"})

    async def index(self, owner: str, document_id: str, text: str):
        chunks = [text[i:i + 1600] for i in range(0, min(len(text), 80000), 1400)]
        if not chunks:
            return 0
        await self.ensure_collection()
        vectors = await self.embeddings(chunks)
        points = [{"id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"medora:{owner}:{document_id}:{i}")), "vector": vector, "payload": {"owner_id": owner, "document_id": document_id, "text": chunk, "chunk": i}} for i, (chunk, vector) in enumerate(zip(chunks, vectors))]
        await self.qdrant("PUT", "/points?wait=true", {"points": points})
        # Keep the last successful index if the replacement upsert fails. Stable
        # chunk IDs replace current chunks; remove only an obsolete trailing range.
        await self.qdrant("POST", "/points/delete?wait=true", {"filter": {"must": [
            {"key": "owner_id", "match": {"value": owner}},
            {"key": "document_id", "match": {"value": document_id}},
            {"key": "chunk", "range": {"gte": len(points)}},
        ]}})
        return len(points)

    async def search(self, owner: str, text: str, allowed_document_ids: list[str]):
        if not self.s.rag_enabled or not allowed_document_ids:
            return []
        vector = (await self.embeddings([text]))[0]
        found = await self.qdrant("POST", "/points/query", {"query": vector, "filter": {"must": [{"key": "owner_id", "match": {"value": owner}}, {"key": "document_id", "match": {"any": allowed_document_ids}}]}, "limit": 6, "with_payload": True})
        matches = []
        for p in (found or {}).get("points", []):
            payload = p.get("payload", {})
            if payload.get("owner_id") == owner and payload.get("document_id") in allowed_document_ids:
                matches.append({
                    "id": p.get("id"),
                    "score": round(float(p.get("score", 0.0)), 4),
                    "document_id": payload.get("document_id"),
                    "owner_id": payload.get("owner_id"),
                    "text": payload.get("text", ""),
                    "chunk": payload.get("chunk", 0)
                })
        return matches

    async def remove_vectors(self, owner: str, doc_id: str):
        if self.s.rag_enabled:
            existing = await self.qdrant("GET", "", allow_missing=True)
            if existing is not None:
                await self.qdrant("POST", "/points/delete?wait=true", {"filter": {"must": [{"key": "owner_id", "match": {"value": owner}}, {"key": "document_id", "match": {"value": doc_id}}]}})

    async def transcribe(self, content: bytes, mime: str, filename: str):
        if not self.s.groq_api_key.get_secret_value():
            raise HTTPException(503, "Configure Groq before transcribing audio")
        response = await self.client.post("https://api.groq.com/openai/v1/audio/transcriptions", headers={"Authorization": "Bearer " + self.s.groq_api_key.get_secret_value()}, files={"file": (filename, content, mime)}, data={"model": self.s.groq_transcription_model, "response_format": "json"})
        if response.is_error:
            raise HTTPException(503, "The transcription provider could not process the audio")
        return str(response.json().get("text", ""))[:30000]

