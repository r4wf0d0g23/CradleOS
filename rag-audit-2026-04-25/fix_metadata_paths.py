#!/usr/bin/env python3
"""
Fix the metadata.image_path field on the 14 ship entries to point at the
canonical images/<name>.png path. We re-fetch with embeddings included,
then upsert with embeddings preserved (avoiding chroma's auto-embed).
"""

import sys
import asyncio
sys.path.insert(0, "/home/rawdata/rag")
from chroma_store import get_collection
from embed_client import embed_texts

SHIPS = [
    "carom", "chumaq", "haf", "lai", "lorha", "maul", "mcf",
    "recurve", "reflex", "reiver", "stride", "tades", "usv", "wend",
]


async def main():
    col = get_collection("eve_frontier_types")

    res = col.get(
        ids=[f"ship_{s}" for s in SHIPS],
        include=["documents", "metadatas", "embeddings"],
    )
    ids = res["ids"]
    metas = res["metadatas"]
    docs = res["documents"]
    embs = res["embeddings"]

    # Patch metadata
    for m in metas:
        name = m.get("name", "").lower()
        if name:
            m["image_path"] = f"images/{name}.png"

    # Patch documents (replace _card.png references with .png)
    new_docs = [d.replace("_card.png", ".png") for d in docs]

    # Upsert with embeddings preserved
    col.upsert(
        ids=ids,
        embeddings=list(embs),
        documents=new_docs,
        metadatas=metas,
    )

    print(f"updated {len(ids)} entries — image_path → images/<name>.png")
    # Verify
    verify = col.get(ids=ids)
    for i, m in enumerate(verify["metadatas"]):
        print(f"  {verify['ids'][i]}: image_path={m.get('image_path')}, name={m.get('name')}, class={m.get('class')}")


if __name__ == "__main__":
    asyncio.run(main())
