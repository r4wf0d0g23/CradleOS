/**
 * ItemTypePicker — searchable EVE Frontier item type selector.
 *
 * Fetches all 390 types from the Stillness API once, caches in React Query,
 * and provides instant client-side filtering by name, group, or category.
 *
 * Usage:
 *   <ItemTypePicker
 *     value={typeId}           // current numeric type_id or null
 *     onChange={(id, name) => { setTypeId(id); setTypeName(name); }}
 *     placeholder="Search items…"
 *   />
 */

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

const STILLNESS_TYPES_URL =
  "https://world-api-stillness.live.tech.evefrontier.com/v2/types?limit=1000";

interface EFType {
  id: number;
  name: string;
  groupName: string;
  categoryName: string;
  volume: number;
}

async function fetchAllTypes(): Promise<EFType[]> {
  const res = await fetch(STILLNESS_TYPES_URL);
  const json = await res.json() as { data: EFType[] };
  return json.data ?? [];
}

// Category colours for badges
const CAT_COLOR: Record<string, string> = {
  Module:     "#ffa032",
  Commodity:  "#00e8ff",
  Material:   "#88cc44",
  Charge:     "#ff6432",
  Deployable: "#cc88ff",
  Ship:       "#FF4700",
  Asteroid:   "#aaaaaa",
};

function catColor(cat: string) {
  return CAT_COLOR[cat] ?? "rgba(107,107,94,0.6)";
}

interface Props {
  value: number | null;
  onChange: (typeId: number, typeName: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ItemTypePicker({ value, onChange, placeholder = "Search items…", disabled }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: allTypes = [] } = useQuery<EFType[]>({
    queryKey: ["ef-item-types"],
    queryFn: fetchAllTypes,
    staleTime: 3_600_000, // 1 hour — types don't change often
    gcTime: 3_600_000,
  });

  // Resolve display label for current value
  const selectedType = value != null ? allTypes.find(t => t.id === value) : null;
  const displayLabel = selectedType
    ? `${selectedType.name} (${selectedType.id})`
    : value != null ? `Type ID ${value}` : "";

  // Filter
  const q = query.trim().toLowerCase();
  const results = q.length < 1 ? [] : allTypes
    .filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.groupName.toLowerCase().includes(q) ||
      t.categoryName.toLowerCase().includes(q) ||
      String(t.id).startsWith(q)
    )
    .slice(0, 30); // cap at 30 for performance

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const inputSx: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,71,0,0.25)",
    color: "#e0e0d0",
    padding: "5px 9px",
    fontSize: "12px",
    fontFamily: "monospace",
    outline: "none",
    borderRadius: "2px",
    boxSizing: "border-box",
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* Trigger — shows current selection or search input */}
      {open ? (
        <input
          autoFocus
          value={query}
          onChange={e => { setQuery(e.target.value); }}
          placeholder={placeholder}
          disabled={disabled}
          style={inputSx}
          onKeyDown={e => {
            if (e.key === "Escape") { setOpen(false); setQuery(""); }
            if (e.key === "Enter" && results.length > 0) {
              onChange(results[0].id, results[0].name);
              setOpen(false);
              setQuery("");
            }
          }}
        />
      ) : (
        <div
          onClick={() => { if (!disabled) setOpen(true); }}
          style={{
            ...inputSx,
            cursor: disabled ? "not-allowed" : "pointer",
            color: selectedType ? "#e0e0d0" : "rgba(107,107,94,0.6)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            userSelect: "none",
          }}
        >
          <span>{displayLabel || placeholder}</span>
          <span style={{ color: "rgba(107,107,94,0.5)", fontSize: "10px" }}>▼</span>
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", zIndex: 200, top: "calc(100% + 2px)", left: 0, right: 0,
          background: "rgba(4,6,14,0.98)", border: "1px solid rgba(255,71,0,0.3)",
          maxHeight: "240px", overflowY: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
        }}>
          {allTypes.length === 0 && (
            <div style={{ padding: "10px 12px", color: "rgba(107,107,94,0.55)", fontSize: "11px" }}>
              Loading types…
            </div>
          )}
          {allTypes.length > 0 && q.length < 1 && (
            <div style={{ padding: "8px 12px", color: "rgba(107,107,94,0.5)", fontSize: "11px" }}>
              Type to search {allTypes.length} items…
            </div>
          )}
          {results.length === 0 && q.length > 0 && (
            <div style={{ padding: "8px 12px", color: "rgba(107,107,94,0.5)", fontSize: "11px" }}>
              No matches for "{query}"
            </div>
          )}
          {results.map(t => (
            <div
              key={t.id}
              onMouseDown={e => {
                e.preventDefault();
                onChange(t.id, t.name);
                setOpen(false);
                setQuery("");
              }}
              style={{
                padding: "7px 12px",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: "10px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,71,0,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {/* Category badge */}
              <span style={{
                fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase",
                color: catColor(t.categoryName),
                border: `1px solid ${catColor(t.categoryName)}44`,
                padding: "1px 5px", borderRadius: "2px", flexShrink: 0,
                fontFamily: "monospace",
              }}>
                {t.categoryName}
              </span>
              {/* Name + group */}
              <span style={{ flex: 1, fontSize: "12px", color: "#e0e0d0" }}>
                {t.name}
                <span style={{ color: "rgba(107,107,94,0.55)", marginLeft: "6px", fontSize: "11px" }}>
                  {t.groupName}
                </span>
              </span>
              {/* ID */}
              <span style={{ fontSize: "10px", fontFamily: "monospace", color: "rgba(107,107,94,0.55)", flexShrink: 0 }}>
                {t.id}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
