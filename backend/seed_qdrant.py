import asyncio
import httpx
import uuid
import json
from medora.config import Settings
from medora.providers import Providers
from medora.store import Store

async def seed_qdrant():
    settings = Settings()
    print("Connecting with settings:")
    print(f"  Qdrant URL: {settings.qdrant_url}")
    print(f"  Qdrant Collection: {settings.qdrant_collection}")
    print(f"  Embedding Dims: {settings.embedding_dimensions}")
    print(f"  RAG Enabled: {settings.rag_enabled}")

    async with httpx.AsyncClient(timeout=60.0) as client:
        providers = Providers(settings, client)
        store = Store(settings, client)

        # 1. Ensure collection exists with right schema
        print("Ensuring Qdrant collection...")
        await providers.ensure_collection()

        # 2. Get patient profile
        profile = await store.profile_by_email("patient@medora.demo")
        print(f"Patient profile: {profile.name} ({profile.id})")

        ws = await store.workspace(profile.id)
        data = ws["data"]
        documents = data.get("documents", [])
        print(f"Found {len(documents)} documents in patient workspace.")

        total_points = 0
        for doc in documents:
            doc_id = doc["id"]
            name = doc.get("name", "Document")
            extracted = doc.get("extractedText") or ""
            summary = doc.get("summary") or ""
            findings = " ".join(doc.get("findings") or [])
            
            # Combine full clinical context for high-quality dense vector representation
            full_text = f"Document: {name} (Category: {doc.get('type')}, Date: {doc.get('date')})\n"
            if extracted:
                full_text += f"Extracted Clinical Content: {extracted}\n"
            if summary:
                full_text += f"Medical Summary: {summary}\n"
            if findings:
                full_text += f"Key Clinical Findings: {findings}\n"

            print(f"Indexing '{name}' (ID: {doc_id}, length {len(full_text)} chars)...")
            chunks_count = await providers.index(profile.id, doc_id, full_text)
            doc["indexed"] = True
            doc["analysisStatus"] = "analysed"
            total_points += chunks_count
            print(f"  -> Indexed {chunks_count} vector points into Qdrant for '{name}'")

        # Save workspace with indexed flags
        await store.save(profile.id, data, ws["version"])
        print(f"Saved workspace! Total vector points inserted: {total_points}")

        # 3. Verify Qdrant points count
        info = await providers.qdrant("GET", "")
        print("Qdrant collection info:", json.dumps({
            "points_count": info.get("points_count"),
            "indexed_vectors_count": info.get("indexed_vectors_count"),
            "vectors_size": info.get("config", {}).get("params", {}).get("vectors", {}).get("size"),
            "status": info.get("status")
        }, indent=2))

        # 4. Test semantic search queries
        test_queries = [
            "What was my last X-Ray and what does it say about lungs and heart?",
            "What were my blood test glucose and cholesterol results?",
            "What did Dr Sarah Khan say during my annual review about blood pressure?",
            "Who am I referred to for cardiology screening?"
        ]

        allowed_ids = [d["id"] for d in documents]
        print("\n--- TESTING SEMANTIC SEARCH QUERIES ---")
        for q in test_queries:
            results = await providers.search(profile.id, q, allowed_ids)
            print(f"\nQuery: '{q}'")
            print(f"Retrieved {len(results)} matches from Qdrant:")
            for i, r in enumerate(results[:2]):
                text_preview = r.get("text", "")[:120].replace('\n', ' ')
                doc_matched = next((d['name'] for d in documents if d['id'] == r.get('document_id')), r.get('document_id'))
                score = r.get("score", "N/A")
                print(f"  Match {i+1} [{doc_matched}] (Score: {score}): {text_preview}...")

if __name__ == "__main__":
    asyncio.run(seed_qdrant())
