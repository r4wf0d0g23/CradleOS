#!/usr/bin/env python3
"""
Reindex the 14 ship entries in chroma `eve_frontier_types` collection from
the corrected_ships.jsonl ground truth.

Strategy: upsert by id (same `ship_<name>` IDs as before). This:
  - rewrites the document text to the corrected/dense version
  - rewrites metadata to include accurate class field
  - re-embeds with current embed model (nemotron-embed)

Run on DGX1 from /home/rawdata/rag.
"""

import sys
import json
import asyncio
from pathlib import Path

sys.path.insert(0, "/home/rawdata/rag")

from chroma_store import get_collection                # noqa: E402
from embed_client import embed_texts                   # noqa: E402

CORPUS_PATH = Path("/home/rawdata/rag/corpus_v2/corrected_ships.jsonl")
COLLECTION = "eve_frontier_types"


async def main():
    rows = []
    with open(CORPUS_PATH) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))

    print(f"loaded {len(rows)} rows from {CORPUS_PATH}")

    # Embed all docs in one batch
    texts = [r["text"] for r in rows]
    print("embedding...")
    vectors = await embed_texts(texts)
    print(f"got {len(vectors)} vectors of dim {len(vectors[0])}")

    # Upsert
    col = get_collection(COLLECTION)
    print(f"upserting into {COLLECTION} (current size: {col.count()})")

    col.upsert(
        ids=[r["id"] for r in rows],
        embeddings=vectors,
        documents=texts,
        metadatas=[r["metadata"] for r in rows],
    )

    print(f"done. new size: {col.count()}")
    print()
    print("--- verification: query 'lai' ---")
    qvec = (await embed_texts(["what is a lai"]))[0]
    res = col.query(query_embeddings=[qvec], n_results=2)
    for i, doc in enumerate(res["documents"][0]):
        meta = res["metadatas"][0][i]
        dist = res["distances"][0][i]
        print(f"  [{i}] dist={dist:.3f} meta={meta}")
        print(f"      doc={doc[:200]}...")


if __name__ == "__main__":
    asyncio.run(main())
