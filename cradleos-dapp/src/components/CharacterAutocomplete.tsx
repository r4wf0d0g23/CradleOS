/**
 * CharacterAutocomplete — searchable character picker for friendly/hostile
 * assignment UIs.
 *
 * Backed by useCharacterDirectory() which hits the same cached source as the
 * Chain Query panel, so a cold load warms both surfaces.
 *
 * Output: the in-game character_id (u32) — the only field defense_policy
 * cares about. Display surfaces name + tribe + short address so the founder
 * can verify they picked the right person before signing.
 *
 * Usage:
 *   <CharacterAutocomplete
 *     onSelect={(c) => addFriendly(c.characterId)}
 *     placeholder="Search by name…"
 *     accentColor="#00c864"   // green for friendly, red for hostile
 *     buttonLabel="+ Add Friendly"
 *     busy={busy}
 *   />
 */
import { useState, useRef, useEffect, useMemo } from "react";
import {
  useCharacterDirectory,
  searchCharacters,
  type CharacterDirectoryEntry,
} from "../lib/characterDirectory";

interface Props {
  /** Called with the picked character. Component clears its state after. */
  onSelect: (entry: CharacterDirectoryEntry) => void | Promise<void>;
  /** Placeholder text for the search input. */
  placeholder?: string;
  /** Color used for selected-row + button styling. Hex or rgb(a) string. */
  accentColor?: string;
  /** Label for the action button. Default "+ Add". */
  buttonLabel?: string;
  /** Disables input + button while a transaction is in flight. */
  busy?: boolean;
  /** Disables the entire component. */
  disabled?: boolean;
}

export function CharacterAutocomplete({
  onSelect,
  placeholder = "Search by name or character ID…",
  accentColor = "#FF4700",
  buttonLabel = "+ Add",
  busy = false,
  disabled = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [picked, setPicked] = useState<CharacterDirectoryEntry | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: directory, isLoading } = useCharacterDirectory();

  // Recompute filtered results whenever the query or directory changes.
  const results = useMemo(
    () => searchCharacters(directory, query, 30),
    [directory, query],
  );

  // Keep highlighted index in range.
  useEffect(() => {
    if (highlighted >= results.length) setHighlighted(0);
  }, [results, highlighted]);

  // Close dropdown on click outside.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Auto-scroll the highlighted entry into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLDivElement>(`[data-idx="${highlighted}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  function commit(entry: CharacterDirectoryEntry) {
    setPicked(entry);
    setQuery("");
    setOpen(false);
  }

  async function handleAdd() {
    if (!picked || busy || disabled) return;
    try {
      await onSelect(picked);
      // Caller may keep us busy briefly; once the parent flips busy back,
      // we clear our internal selection so the UI is ready for the next add.
      setPicked(null);
    } catch {
      // Swallow — caller surfaces the error via its own busy/err state.
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        return;
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[highlighted]) commit(results[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const selectedColor = accentColor;
  const trimmedQuery = query.trim();
  // Detect a numeric character ID typed directly — let the founder add by id
  // without needing to find the row in the dropdown.
  const numericId = /^\d+$/.test(trimmedQuery) ? parseInt(trimmedQuery, 10) : null;
  const numericIdValid = numericId !== null && numericId > 0 && numericId <= 0xffffffff;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {picked ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "5px 10px",
          background: `${selectedColor}10`, border: `1px solid ${selectedColor}55`,
          borderRadius: 2, fontSize: 11,
        }}>
          <span style={{ color: selectedColor, fontWeight: 600 }}>{picked.name || `Character #${picked.characterId}`}</span>
          <span style={{ color: "rgba(175,175,155,0.55)", fontFamily: "monospace", fontSize: 10 }}>
            #{picked.characterId} · tribe {picked.tribeId}
          </span>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => setPicked(null)}
            disabled={busy}
            style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#888", borderRadius: 2, padding: "2px 8px", fontSize: 10, cursor: busy ? "default" : "pointer" }}
          >Change</button>
          <button
            onClick={handleAdd}
            disabled={busy || disabled}
            style={{
              background: `${selectedColor}1a`, border: `1px solid ${selectedColor}55`,
              color: selectedColor, borderRadius: 2, fontSize: 11, padding: "4px 12px", fontWeight: 600,
              cursor: busy || disabled ? "default" : "pointer",
            }}
          >{busy ? "..." : buttonLabel}</button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true); setHighlighted(0); }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              disabled={disabled || busy}
              placeholder={isLoading ? "Loading character directory…" : placeholder}
              style={{
                flex: 1, minWidth: 220, background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 0,
                color: "#aaa", fontSize: 11, padding: "5px 8px", outline: "none",
                fontFamily: "inherit",
              }}
            />
            {/* Numeric-id fallback: lets a founder paste a raw character ID
                from elsewhere (Chain Query, etc.) and add it even if the
                directory hasn't loaded or doesn't include the character. */}
            {numericIdValid && (
              <button
                onClick={() => {
                  // Synthesize an entry for the unknown id — name will resolve
                  // later when the directory loads and rows enrich themselves.
                  const synth: CharacterDirectoryEntry = {
                    objectId: "",
                    characterId: numericId!,
                    name: "",
                    description: "",
                    tribeId: 0,
                    characterAddress: "",
                  };
                  commit(synth);
                }}
                disabled={busy || disabled}
                style={{
                  background: `${selectedColor}10`, border: `1px solid ${selectedColor}55`,
                  color: selectedColor, borderRadius: 2, fontSize: 10, padding: "5px 10px",
                  cursor: busy || disabled ? "default" : "pointer",
                }}
              >Use #{numericId}</button>
            )}
          </div>

          {open && trimmedQuery.length >= 1 && (
            <div
              ref={listRef}
              style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 1000,
                maxHeight: 280, overflowY: "auto",
                background: "rgba(20,18,15,0.97)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 2, boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
              }}
            >
              {isLoading && results.length === 0 ? (
                <div style={{ padding: "10px 12px", fontSize: 11, color: "rgba(175,175,155,0.5)" }}>
                  Loading characters… first run can take 5-15 seconds.
                </div>
              ) : results.length === 0 ? (
                <div style={{ padding: "10px 12px", fontSize: 11, color: "rgba(175,175,155,0.5)" }}>
                  No matches for "{trimmedQuery}".{numericIdValid ? " Use the button above to add by ID." : ""}
                </div>
              ) : (
                results.map((c, i) => {
                  const hi = i === highlighted;
                  return (
                    <div
                      key={c.objectId || `id-${c.characterId}`}
                      data-idx={i}
                      onMouseEnter={() => setHighlighted(i)}
                      onMouseDown={e => { e.preventDefault(); commit(c); }}
                      style={{
                        padding: "6px 10px", cursor: "pointer", fontSize: 11,
                        background: hi ? `${selectedColor}1a` : "transparent",
                        borderLeft: `2px solid ${hi ? selectedColor : "transparent"}`,
                        display: "flex", alignItems: "center", gap: 8,
                      }}
                    >
                      <span style={{ flex: 1, color: c.name ? "#e0e0d0" : "rgba(175,175,155,0.55)" }}>
                        {c.name || `(unnamed)`}
                      </span>
                      <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(175,175,155,0.55)" }}>
                        tribe {c.tribeId}
                      </span>
                      <span style={{ fontFamily: "monospace", fontSize: 10, color: hi ? selectedColor : "rgba(175,175,155,0.45)" }}>
                        #{c.characterId}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
