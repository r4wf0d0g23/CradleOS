/**
 * QueryPanel — Search characters and tribes by name.
 * Sources: Sui GraphQL (Character objects) + World API (tribes) + CoinLaunched events (CradleOS vaults)
 */
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { SUI_GRAPHQL, WORLD_API, WORLD_PKG, WORLD_PKG_UTOPIA_V1, CRADLEOS_ORIGINAL, SUI_TESTNET_RPC, SERVER_LABEL } from "../constants";
import { numish, isTribeOnActiveServer } from "../lib";

// ── Types ──────────────────────────────────────────────────────────────────

type CharacterResult = {
  objectId: string;
  characterAddress: string;
  name: string;
  description: string;
  tribeId: number;
  itemId: string;
};

type TribeResult = {
  id: number;
  name: string;
  ticker: string;
  description: string;
  taxRate: number;
  url: string;
};

type CradleOSVault = {
  tribeId: number;
  vaultId: string;
  coinSymbol: string;
  coinName: string;
};

// ── Fetchers ───────────────────────────────────────────────────────────────

async function fetchCharactersByPkg(charType: string): Promise<CharacterResult[]> { // eslint-disable-line @typescript-eslint/no-unused-vars
  const results: CharacterResult[] = [];
  let cursor: string | null = null;
  // Rolling paginated fetch — continues until hasNextPage is false (no hard cap)
  do {
    const query = `{
      objects(filter: { type: "${charType}" }
        first: 50
        ${cursor ? `after: "${cursor}"` : ""}
      ) {
        nodes { address asMoveObject { contents { json } } }
        pageInfo { hasNextPage endCursor }
      }
    }`;
    const res = await fetch(SUI_GRAPHQL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const json = await res.json() as {
      data?: { objects?: {
        nodes?: Array<{ address: string; asMoveObject?: { contents?: { json?: Record<string, unknown> } } }>;
        pageInfo?: { hasNextPage: boolean; endCursor: string };
      } }
    };
    const nodes = json.data?.objects?.nodes ?? [];
    for (const n of nodes) {
      const j = n.asMoveObject?.contents?.json ?? {};
      const meta = (j.metadata as Record<string, unknown>) ?? {};
      results.push({
        objectId: n.address,
        characterAddress: String(j.character_address ?? ""),
        name: String(meta.name ?? ""),
        description: String(meta.description ?? ""),
        tribeId: numish(j.tribe_id) ?? 0,
        itemId: String((j.key as Record<string, unknown>)?.item_id ?? ""),
      });
    }
    const pageInfo = json.data?.objects?.pageInfo;
    cursor = pageInfo?.hasNextPage ? (pageInfo.endCursor ?? null) : null;
  } while (cursor);
  return results;
}

async function fetchAllCharacters(): Promise<CharacterResult[]> {
  // Fetch from both world pkg versions — characters created before v0.0.21 are typed against v1
  const [v2, v1] = await Promise.all([
    fetchCharactersByPkg(`${WORLD_PKG}::character::Character`),
    fetchCharactersByPkg(`${WORLD_PKG_UTOPIA_V1}::character::Character`),
  ]);
  // Deduplicate by objectId
  const seen = new Set<string>();
  return [...v2, ...v1].filter(c => { if (seen.has(c.objectId)) return false; seen.add(c.objectId); return true; });
}

async function fetchAllTribes(): Promise<TribeResult[]> {
  const res = await fetch(`${WORLD_API}/v2/tribes?limit=200`);
  const json = await res.json() as { data?: Array<{ id: number; name: string; nameShort: string; description: string; taxRate: number; tribeUrl: string }> };
  return (json.data ?? []).map(t => ({ id: t.id, name: t.name, ticker: t.nameShort, description: t.description, taxRate: t.taxRate, url: t.tribeUrl }));
}

async function fetchCradleOSVaults(): Promise<CradleOSVault[]> {
  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_queryEvents",
      params: [{ MoveEventType: `${CRADLEOS_ORIGINAL}::tribe_vault::CoinLaunched` }, null, 200, true] }),
  });
  const json = await res.json() as { result?: { data?: Array<{ parsedJson?: Record<string, unknown> }> } };
  // Group by tribeId, prefer the newest event with a non-empty coin_name
  // (the canonical launch); fall back to newest empty event when none have
  // a name. Same pattern as fetchAllRegisteredTribes — see lib.ts.
  type Evt = { parsedJson?: Record<string, unknown> };
  const byTribe = new Map<number, Evt[]>();
  for (const e of (json.result?.data ?? []) as Evt[]) {
    const tribeId = numish(e.parsedJson?.tribe_id) ?? 0;
    if (!tribeId) continue;
    if (!byTribe.has(tribeId)) byTribe.set(tribeId, []);
    byTribe.get(tribeId)!.push(e);
  }
  const candidates: CradleOSVault[] = [];
  for (const [tribeId, events] of byTribe) {
    const named = events.find(e => String(e.parsedJson?.coin_name ?? "").length > 0);
    const chosen = named ?? events[0];
    candidates.push({
      tribeId,
      vaultId: String(chosen.parsedJson?.vault_id ?? ""),
      coinSymbol: String(chosen.parsedJson?.coin_symbol ?? "?"),
      coinName: String(chosen.parsedJson?.coin_name ?? ""),
    });
  }
  // Server-membership gate: pass coin_symbol + coin_name so the helper can
  // match against the World API's tribe nameShort/name (existence-only is
  // not sufficient — same tribeId can refer to different tribes on
  // Stillness vs Utopia).
  const onServerFlags = await Promise.all(
    candidates.map(v => isTribeOnActiveServer(v.tribeId, v.coinSymbol, v.coinName)),
  );
  return candidates.filter((_, i) => onServerFlags[i]);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function short(addr: string, n = 10) {
  return addr ? `${addr.slice(0, n)}…${addr.slice(-6)}` : "—";
}

function copyToClipboard(value: string): boolean {
  // Try modern Clipboard API first
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).catch(() => {});
    return true;
  }
  // Fallback: create a temp textarea and execCommand (works in CEF/older browsers)
  try {
    const el = document.createElement("textarea");
    el.value = value;
    el.style.position = "fixed";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { copyToClipboard(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{ background: "none", border: "none", color: copied ? "#00ff96" : "rgba(107,107,94,0.5)", cursor: "pointer", fontSize: 10, padding: "0 4px" }}
    >{copied ? "✓" : "⎘"}</button>
  );
}

const S = {
  card: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,71,0,0.15)", borderRadius: 4, padding: "12px 16px", marginBottom: 8 } as React.CSSProperties,
  label: { fontSize: 9, color: "rgba(180,180,160,0.5)", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 2 },
  value: { fontSize: 12, color: "#e0e0d0", fontFamily: "monospace" as const },
  tag: (color: string) => ({ display: "inline-block", background: `${color}18`, border: `1px solid ${color}44`, color, borderRadius: 3, padding: "1px 7px", fontSize: 10, fontWeight: 600 }),
};

// ── Main component ─────────────────────────────────────────────────────────

export function QueryPanel() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"character" | "tribe">("character");
  const [selectedChar, setSelectedChar] = useState<CharacterResult | null>(null);
  const [selectedTribe, setSelectedTribe] = useState<TribeResult | null>(null);

  const { data: characters, isLoading: charsLoading } = useQuery({
    queryKey: ["allCharacters"],
    queryFn: fetchAllCharacters,
    staleTime: 15 * 60_000, // cache 15 min — full paginated fetch is expensive
  });

  const { data: tribes, isLoading: tribesLoading } = useQuery({
    queryKey: ["allTribes"],
    queryFn: fetchAllTribes,
    staleTime: 5 * 60_000,
  });

  const { data: vaults } = useQuery({
    queryKey: ["cradleosVaults"],
    queryFn: fetchCradleOSVaults,
    staleTime: 60_000,
  });

  const q = query.trim().toLowerCase();

  const isWildcard = q === "*";
  const showResults = isWildcard || q.length >= 2;

  const filteredChars = !showResults ? [] : isWildcard
    ? (characters ?? []).slice(0, 100)
    : (characters ?? []).filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.characterAddress.toLowerCase().includes(q) ||
        c.objectId.toLowerCase().includes(q)
      ).slice(0, 50);

  const filteredTribes = !showResults ? [] : isWildcard
    ? (tribes ?? [])
    : (tribes ?? []).filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.ticker.toLowerCase().includes(q) ||
        String(t.id).includes(q)
      ).slice(0, 50);

  const vaultForTribe = useCallback((tribeId: number) =>
    (vaults ?? []).find(v => v.tribeId === tribeId), [vaults]);

  const tribeForId = useCallback((tribeId: number) =>
    (tribes ?? []).find(t => t.id === tribeId), [tribes]);

  const isLoading = charsLoading || tribesLoading;

  return (
    <div style={{ padding: 20, maxWidth: 860, margin: "0 auto" }}>
      <div style={{ color: "#FF4700", fontWeight: 700, fontSize: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        Chain Query
        <span style={{ fontSize: 10, fontWeight: 400, color: "rgba(180,180,160,0.5)", background: "rgba(255,71,0,0.08)", border: "1px solid rgba(255,71,0,0.2)", borderRadius: 3, padding: "1px 8px", letterSpacing: 1 }}>
          {SERVER_LABEL}
        </span>
      </div>

      {/* Mode toggle + search */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(["character", "tribe"] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setQuery(""); setSelectedChar(null); setSelectedTribe(null); }}
            style={{ padding: "5px 16px", borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: mode === m ? "rgba(255,71,0,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${mode === m ? "rgba(255,71,0,0.5)" : "rgba(255,255,255,0.1)"}`,
              color: mode === m ? "#FF4700" : "#888",
            }}>
            {m === "character"
              ? <><img src="/ef-character.svg" alt="" style={{ width: 14, height: 14, opacity: 0.65, verticalAlign: "middle", marginRight: 5, filter: "brightness(0) invert(1) sepia(1) saturate(3) hue-rotate(330deg)" }} />Rider</>
              : <><img src="/ef-corporation.svg" alt="" style={{ width: 14, height: 14, opacity: 0.65, verticalAlign: "middle", marginRight: 5, filter: "brightness(0) invert(1) sepia(1) saturate(3) hue-rotate(330deg)" }} />Tribe</>
            }
          </button>
        ))}
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedChar(null); setSelectedTribe(null); }}
          placeholder={mode === "character" ? "Search by name or wallet address…" : "Search by tribe name or ticker…"}
          style={{ flex: 1, minWidth: 200, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 3, color: "#e0e0d0", fontSize: 12, padding: "6px 12px", outline: "none" }}
          autoFocus
        />
        {isLoading && <span style={{ fontSize: 11, color: "#ffa032", alignSelf: "center" }}>● indexing…</span>}
      </div>

      {/* Results list */}
      {showResults && !selectedChar && !selectedTribe && (
        <div>
          {mode === "character" && (
            charsLoading
              ? <div style={{ color: "#aaa", fontSize: 12 }}>Loading characters… {filteredChars.length > 0 ? `(${filteredChars.length} so far)` : ""}</div>
              : filteredChars.length === 0
              ? <div style={{ color: "rgba(107,107,94,0.55)", fontSize: 12 }}>
                  No characters found for "{query}"
                  {characters ? <span style={{ color: "rgba(107,107,94,0.4)" }}> — searched {characters.length} indexed characters</span> : " (index still loading)"}
                </div>
              : filteredChars.map(c => (
                <div key={c.objectId} onClick={() => setSelectedChar(c)} style={{ ...S.card, cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,71,0,0.4)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,71,0,0.15)")}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#e0e0d0" }}>{c.name || "—"}</span>
                    <span style={S.tag("#ffd700")}>
                      {tribeForId(c.tribeId)?.ticker ?? `tribe ${c.tribeId}`}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(107,107,94,0.55)", fontFamily: "monospace", marginTop: 2 }}>
                    {short(c.characterAddress, 14)} · item {c.itemId}
                  </div>
                </div>
              ))
          )}
          {mode === "tribe" && (
            filteredTribes.length === 0
              ? <div style={{ color: "rgba(107,107,94,0.55)", fontSize: 12 }}>No tribes found for "{query}"</div>
              : filteredTribes.map(t => (
                <div key={t.id} onClick={() => setSelectedTribe(t)} style={{ ...S.card, cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,71,0,0.4)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,71,0,0.15)")}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#e0e0d0" }}>{t.name}</span>
                    <span style={S.tag("#FF4700")}>{t.ticker}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(107,107,94,0.55)", marginTop: 2 }}>
                    Tribe ID: {t.id}{vaultForTribe(t.id) ? ` · CradleOS: ${vaultForTribe(t.id)!.coinSymbol}` : ""}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* Character detail */}
      {selectedChar && (
        <CharacterDetail char={selectedChar} tribe={tribeForId(selectedChar.tribeId) ?? null} vault={vaultForTribe(selectedChar.tribeId) ?? null}
          onBack={() => setSelectedChar(null)} />
      )}

      {/* Tribe detail */}
      {selectedTribe && (
        <TribeDetail tribe={selectedTribe} vault={vaultForTribe(selectedTribe.id) ?? null} characters={(characters ?? []).filter(c => c.tribeId === selectedTribe.id)}
          onBack={() => setSelectedTribe(null)} />
      )}

      {!showResults && !selectedChar && !selectedTribe && (
        <div style={{ color: "rgba(107,107,94,0.4)", fontSize: 12, marginTop: 8 }}>
          Type a name to search, or <strong style={{ color: "#FF4700" }}>*</strong> to list all. {characters ? `${characters.length} characters` : ""} {tribes ? `· ${tribes.length} tribes` : ""} indexed.
        </div>
      )}
    </div>
  );
}

// ── Character detail view ──────────────────────────────────────────────────

function CharacterDetail({ char, tribe, vault, onBack }: {
  char: CharacterResult;
  tribe: TribeResult | null;
  vault: CradleOSVault | null;
  onBack: () => void;
}) {
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#FF4700", cursor: "pointer", fontSize: 12, marginBottom: 12, padding: 0 }}>
        ← Back to results
      </button>
      <div style={S.card}>
        <div style={{ fontWeight: 700, fontSize: 18, color: "#e0e0d0", marginBottom: 12 }}>{char.name || "Unnamed"}</div>
        {char.description && <div style={{ fontSize: 12, color: "#aaa", marginBottom: 12 }}>{char.description}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
          <Field label="Character Address" value={char.characterAddress} copy />
          <Field label="Character Object ID" value={char.objectId} copy />
          <Field label="Item ID" value={char.itemId} />
          <Field label="Tribe ID" value={String(char.tribeId)} />
        </div>

        {tribe && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,71,0,0.1)" }}>
            <div style={{ fontSize: 11, color: "rgba(180,180,160,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Tribe</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600, color: "#e0e0d0" }}>{tribe.name}</span>
              <span style={S.tag("#FF4700")}>{tribe.ticker}</span>
              {tribe.taxRate > 0 && <span style={{ fontSize: 11, color: "#aaa" }}>Tax: {tribe.taxRate}%</span>}
              {tribe.url && <a href={tribe.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#4a9eff" }}>{tribe.url}</a>}
            </div>
          </div>
        )}

        {vault && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,71,0,0.1)" }}>
            <div style={{ fontSize: 11, color: "rgba(180,180,160,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>CradleOS Vault</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={S.tag("#00ff96")}>{vault.coinSymbol}</span>
              <span style={{ fontSize: 12, color: "#aaa" }}>{vault.coinName}</span>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(107,107,94,0.6)" }}>{short(vault.vaultId)}</span>
              <CopyButton value={vault.vaultId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tribe detail view ──────────────────────────────────────────────────────

function TribeDetail({ tribe, vault, characters, onBack }: {
  tribe: TribeResult;
  vault: CradleOSVault | null;
  characters: CharacterResult[];
  onBack: () => void;
}) {
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#FF4700", cursor: "pointer", fontSize: 12, marginBottom: 12, padding: 0 }}>
        ← Back to results
      </button>
      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#e0e0d0" }}>{tribe.name}</span>
          <span style={S.tag("#FF4700")}>{tribe.ticker}</span>
          {vault && <span style={S.tag("#00ff96")}>{vault.coinSymbol} on CradleOS</span>}
        </div>
        {tribe.description && <div style={{ fontSize: 12, color: "#aaa", marginBottom: 12 }}>{tribe.description}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
          <Field label="Tribe ID" value={String(tribe.id)} />
          <Field label="Tax Rate" value={`${tribe.taxRate}%`} />
          {tribe.url && <Field label="Website" value={tribe.url} />}
          {vault && <Field label="Vault" value={vault.vaultId} copy />}
        </div>

        {characters.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,71,0,0.1)" }}>
            <div style={{ fontSize: 11, color: "rgba(180,180,160,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Members ({characters.length} on-chain)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {characters.map(c => (
                <div key={c.objectId} style={{ display: "flex", gap: 10, fontSize: 12, alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "#e0e0d0", minWidth: 120 }}>{c.name || "—"}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(107,107,94,0.6)", flex: 1 }}>{short(c.characterAddress, 14)}</span>
                  <CopyButton value={c.characterAddress} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div>
      <div style={S.label}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={S.value}>{value || "—"}</span>
        {copy && value && <CopyButton value={value} />}
      </div>
    </div>
  );
}
