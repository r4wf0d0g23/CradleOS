import { useState, useMemo, useRef, useEffect } from "react";
import industryData from "../data/industry.json";

// ── Types ────────────────────────────────────────────────────────────────────

interface TypeInfo {
  name: string;
  category: string;
  group: string;
}

interface BlueprintMaterial {
  quantity: number;
  typeID: number;
}

interface Blueprint {
  bpId: number;
  time: number;
  materials: BlueprintMaterial[];
  products: BlueprintMaterial[];
}

interface TreeNode {
  typeId: number;
  name: string;
  category: string;
  group: string;
  quantity: number;
  timePerUnit: number;
  totalTime: number;
  isRaw: boolean;
  depth: number;
  children: TreeNode[];
}

interface RawSummaryItem {
  typeId: number;
  name: string;
  category: string;
  group: string;
  totalQuantity: number;
}

interface TimeSummary {
  totalSeconds: number;
  byDepth: { depth: number; label: string; seconds: number }[];
}

// ── Data setup ────────────────────────────────────────────────────────────────

const types = industryData.types as Record<string, TypeInfo>;
const blueprints = industryData.blueprints as Record<string, Blueprint>;

// Build productToBp: typeID (number) → blueprint key (string)
const productToBp = new Map<number, string>();
for (const [key, bp] of Object.entries(blueprints)) {
  for (const prod of bp.products) {
    productToBp.set(prod.typeID, key);
  }
}

// Collect all producible typeIDs (products of blueprints)
const producibleTypeIds = new Set<number>();
for (const bp of Object.values(blueprints)) {
  for (const prod of bp.products) {
    producibleTypeIds.add(prod.typeID);
  }
}

function getTypeInfo(typeId: number): TypeInfo {
  const info = types[String(typeId)];
  if (!info) return { name: `Unknown (${typeId})`, category: "Unknown", group: "" };
  return {
    name: info.name || `type_${typeId}`,
    category: info.category || "Unknown",
    group: info.group || "",
  };
}

// ── Supply tree builder ───────────────────────────────────────────────────────

function buildSupplyTree(
  productTypeId: number,
  qty: number,
  depth: number,
  visited: Set<number>
): TreeNode {
  const info = getTypeInfo(productTypeId);
  const bpKey = productToBp.get(productTypeId);

  if (!bpKey || visited.has(productTypeId)) {
    // Raw material or cycle guard
    return {
      typeId: productTypeId,
      name: info.name,
      category: info.category,
      group: info.group,
      quantity: qty,
      timePerUnit: 0,
      totalTime: 0,
      isRaw: true,
      depth,
      children: [],
    };
  }

  const bp = blueprints[bpKey];
  // How many blueprint runs do we need?
  const productEntry = bp.products.find(p => p.typeID === productTypeId);
  const producedPerRun = productEntry?.quantity ?? 1;
  const runs = Math.ceil(qty / producedPerRun);

  const newVisited = new Set(visited);
  newVisited.add(productTypeId);

  const children: TreeNode[] = bp.materials.map(mat => {
    const childQty = mat.quantity * runs;
    return buildSupplyTree(mat.typeID, childQty, depth + 1, newVisited);
  });

  const selfTime = bp.time * runs;
  const childTotalTime = children.reduce((s, c) => s + c.totalTime, 0);

  return {
    typeId: productTypeId,
    name: info.name,
    category: info.category,
    group: info.group,
    quantity: qty,
    timePerUnit: bp.time,
    totalTime: selfTime + childTotalTime,
    isRaw: false,
    depth,
    children,
  };
}

// ── Aggregators ───────────────────────────────────────────────────────────────

function collectRawMaterials(node: TreeNode, acc: Map<number, RawSummaryItem>) {
  if (node.isRaw) {
    const existing = acc.get(node.typeId);
    if (existing) {
      existing.totalQuantity += node.quantity;
    } else {
      acc.set(node.typeId, {
        typeId: node.typeId,
        name: node.name,
        category: node.category,
        group: node.group,
        totalQuantity: node.quantity,
      });
    }
    return;
  }
  for (const child of node.children) {
    collectRawMaterials(child, acc);
  }
}

function collectTimeByDepth(node: TreeNode, acc: Map<number, number>) {
  if (!node.isRaw && node.timePerUnit > 0) {
    const selfTime = node.timePerUnit * Math.ceil(node.quantity);
    acc.set(node.depth, (acc.get(node.depth) ?? 0) + selfTime);
  }
  for (const child of node.children) {
    collectTimeByDepth(child, acc);
  }
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtTime(seconds: number): string {
  if (seconds === 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── Category colors ───────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  Ship:      { bg: "rgba(220,40,40,0.18)",  text: "#ff6b6b" },
  Module:    { bg: "rgba(255,140,0,0.18)",  text: "#ffaa33" },
  Charge:    { bg: "rgba(220,200,0,0.18)",  text: "#ffe033" },
  Material:  { bg: "rgba(40,180,80,0.18)",  text: "#44cc66" },
  Commodity: { bg: "rgba(40,80,220,0.18)",  text: "#6699ff" },
  Asteroid:  { bg: "rgba(130,130,130,0.15)", text: "#aaaaaa" },
  Raw:       { bg: "rgba(100,100,100,0.15)", text: "#999999" },
  Unknown:   { bg: "rgba(80,80,80,0.12)",   text: "#888888" },
};

function catStyle(cat: string, isRaw: boolean) {
  if (isRaw) return CAT_COLORS["Raw"];
  return CAT_COLORS[cat] ?? CAT_COLORS["Unknown"];
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ label, colors }: { label: string; colors: { bg: string; text: string } }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 6px",
      borderRadius: "2px",
      fontSize: "9px",
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      background: colors.bg,
      color: colors.text,
      border: `1px solid ${colors.text}33`,
      fontFamily: "IBM Plex Mono, monospace",
      flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

// ── Tree Node Row ─────────────────────────────────────────────────────────────

function TreeRow({ node, expanded, onToggle }: {
  node: TreeNode;
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {
  const key = `${node.depth}-${node.typeId}-${node.quantity}`;
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(key);
  const colors = catStyle(node.category, node.isRaw);

  const indent = node.depth * 16;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 8px 4px 0",
          paddingLeft: `${indent + 8}px`,
          borderLeft: node.depth > 0
            ? `2px solid rgba(255,71,0,${Math.max(0.08, 0.35 - node.depth * 0.07)})`
            : "none",
          marginLeft: node.depth > 0 ? "0" : "0",
          cursor: hasChildren ? "pointer" : "default",
          background: node.depth === 0 ? "rgba(255,71,0,0.06)" : "transparent",
          borderRadius: "0",
          transition: "background 0.1s",
        }}
        onClick={() => hasChildren && onToggle(key)}
        onMouseEnter={e => {
          if (hasChildren) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,71,0,0.04)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.background =
            node.depth === 0 ? "rgba(255,71,0,0.06)" : "transparent";
        }}
      >
        {/* Expand/collapse chevron */}
        <span style={{
          fontSize: "9px",
          color: "rgba(255,71,0,0.5)",
          width: "10px",
          flexShrink: 0,
          fontFamily: "monospace",
        }}>
          {hasChildren ? (isOpen ? "▾" : "▸") : ""}
        </span>

        {/* Icon */}
        <span style={{ fontSize: "11px", flexShrink: 0 }}>
          {node.isRaw ? "🪨" : "⚙"}
        </span>

        {/* Name */}
        <span style={{
          flex: 1,
          fontSize: "12px",
          fontFamily: "IBM Plex Mono, monospace",
          color: node.depth === 0 ? "#FF4700" : node.isRaw ? "#999" : "rgba(220,200,180,0.9)",
          fontWeight: node.depth === 0 ? 700 : 400,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {node.name}
        </span>

        {/* Quantity */}
        <span style={{
          fontSize: "11px",
          fontFamily: "IBM Plex Mono, monospace",
          color: "#FF4700",
          fontWeight: 700,
          flexShrink: 0,
        }}>
          ×{node.quantity.toLocaleString()}
        </span>

        {/* Category badge */}
        <Badge
          label={node.isRaw ? "RAW" : node.category}
          colors={colors}
        />

        {/* Time */}
        {!node.isRaw && node.timePerUnit > 0 && (
          <span style={{
            fontSize: "9px",
            fontFamily: "IBM Plex Mono, monospace",
            color: "rgba(180,160,140,0.4)",
            flexShrink: 0,
          }}>
            ⏱{fmtTime(node.timePerUnit * node.quantity)}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isOpen && node.children.map((child, i) => (
        <TreeRow
          key={`${child.depth}-${child.typeId}-${i}`}
          node={child}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function IndustryPanel() {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // All producible products, sorted by category then name
  const products = useMemo(() => {
    const result: { typeId: number; info: TypeInfo }[] = [];
    for (const typeId of producibleTypeIds) {
      const info = getTypeInfo(typeId);
      result.push({ typeId, info });
    }
    return result.sort((a, b) => {
      const catCmp = a.info.category.localeCompare(b.info.category);
      if (catCmp !== 0) return catCmp;
      return a.info.name.localeCompare(b.info.name);
    });
  }, []);

  // Filtered products
  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      p.info.name.toLowerCase().includes(q) ||
      p.info.category.toLowerCase().includes(q) ||
      p.info.group.toLowerCase().includes(q)
    );
  }, [products, search]);

  // Group filtered by category
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const cat = item.info.category || "Unknown";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return map;
  }, [filtered]);

  // Build tree
  const tree = useMemo(() => {
    if (selectedTypeId === null) return null;
    const qty = Math.max(1, Math.floor(quantity));
    return buildSupplyTree(selectedTypeId, qty, 0, new Set());
  }, [selectedTypeId, quantity]);

  // Auto-expand root children when tree changes
  useEffect(() => {
    if (!tree) { setExpanded(new Set()); return; }
    const initialExpanded = new Set<string>();
    // Expand root node itself
    const rootKey = `0-${tree.typeId}-${tree.quantity}`;
    initialExpanded.add(rootKey);
    // Expand first level
    tree.children.forEach((child) => {
      const key = `${child.depth}-${child.typeId}-${child.quantity}`;
      initialExpanded.add(key);
    });
    setExpanded(initialExpanded);
  }, [tree]);

  // Raw materials summary
  const rawSummary = useMemo(() => {
    if (!tree) return [];
    const acc = new Map<number, RawSummaryItem>();
    collectRawMaterials(tree, acc);
    return Array.from(acc.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [tree]);

  // Time summary
  const timeSummary = useMemo((): TimeSummary => {
    if (!tree) return { totalSeconds: 0, byDepth: [] };
    const depthMap = new Map<number, number>();
    collectTimeByDepth(tree, depthMap);
    const total = Array.from(depthMap.values()).reduce((s, v) => s + v, 0);
    const byDepth = Array.from(depthMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([depth, seconds]) => ({
        depth,
        label: depth === 0 ? "Final product" : `Level ${depth}`,
        seconds,
      }));
    return { totalSeconds: total, byDepth };
  }, [tree]);

  const handleToggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelect = (typeId: number, name: string) => {
    setSelectedTypeId(typeId);
    setSearch(name);
    setShowDropdown(false);
    inputRef.current?.blur();
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedInfo = selectedTypeId !== null ? getTypeInfo(selectedTypeId) : null;

  return (
    <div style={{
      fontFamily: "IBM Plex Mono, monospace",
      color: "rgba(220,200,180,0.9)",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      maxWidth: "900px",
    }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,71,0,0.2)", paddingBottom: "12px" }}>
        <div style={{
          fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase",
          color: "rgba(255,71,0,0.7)", marginBottom: "4px",
        }}>
          ⚙ Industry — Supply Chain Calculator
        </div>
        <div style={{ fontSize: "10px", color: "rgba(180,160,140,0.4)", letterSpacing: "0.08em" }}>
          {Object.keys(blueprints).length} blueprints · {producibleTypeIds.size} producible items
        </div>
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>

        {/* Product search */}
        <div style={{ position: "relative", flex: "1 1 280px" }}>
          <div style={{ fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,71,0,0.5)", marginBottom: "4px" }}>
            Product to build
          </div>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setShowDropdown(true);
              if (!e.target.value) setSelectedTypeId(null);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search by name, category, group..."
            style={{
              width: "100%",
              background: "#0d0d0d",
              border: "1px solid rgba(255,71,0,0.3)",
              color: "#FF4700",
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: "12px",
              padding: "8px 12px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          {/* Dropdown */}
          {showDropdown && filtered.length > 0 && (
            <div
              ref={dropdownRef}
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "#111",
                border: "1px solid rgba(255,71,0,0.3)",
                borderTop: "none",
                maxHeight: "320px",
                overflowY: "auto",
                zIndex: 100,
                boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
              }}
            >
              {Array.from(grouped.entries()).map(([cat, items]) => (
                <div key={cat}>
                  <div style={{
                    padding: "4px 10px",
                    fontSize: "8px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "rgba(255,71,0,0.4)",
                    background: "rgba(255,71,0,0.04)",
                    borderTop: "1px solid rgba(255,71,0,0.1)",
                    position: "sticky",
                    top: 0,
                  }}>
                    {cat} ({items.length})
                  </div>
                  {items.map(({ typeId, info }) => (
                    <div
                      key={typeId}
                      onMouseDown={() => handleSelect(typeId, info.name)}
                      style={{
                        padding: "6px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        borderBottom: "1px solid rgba(255,71,0,0.05)",
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,71,0,0.1)"}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
                    >
                      <span style={{ fontSize: "11px", color: "rgba(220,200,180,0.9)", flex: 1 }}>
                        {info.name}
                      </span>
                      {info.group && (
                        <span style={{ fontSize: "9px", color: "rgba(180,160,140,0.4)" }}>
                          {info.group}
                        </span>
                      )}
                      <Badge label={cat} colors={catStyle(cat, false)} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quantity */}
        <div style={{ flex: "0 0 140px" }}>
          <div style={{ fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,71,0,0.5)", marginBottom: "4px" }}>
            Quantity
          </div>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            style={{
              width: "100%",
              background: "#0d0d0d",
              border: "1px solid rgba(255,71,0,0.3)",
              color: "#FF4700",
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: "14px",
              fontWeight: 700,
              padding: "8px 12px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Selected product info strip */}
      {selectedInfo && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "8px 12px",
          background: "rgba(255,71,0,0.04)",
          border: "1px solid rgba(255,71,0,0.15)",
        }}>
          <span style={{ fontSize: "18px" }}>⚙</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#FF4700" }}>{selectedInfo.name}</div>
            <div style={{ fontSize: "10px", color: "rgba(180,160,140,0.5)" }}>{selectedInfo.group}</div>
          </div>
          <Badge label={selectedInfo.category} colors={catStyle(selectedInfo.category, false)} />
          {tree && (
            <div style={{ fontSize: "10px", color: "rgba(180,160,140,0.5)", textAlign: "right" }}>
              <div>Total time: <span style={{ color: "#FF4700" }}>{fmtTime(timeSummary.totalSeconds)}</span></div>
              <div>Raw inputs: <span style={{ color: "#FF4700" }}>{rawSummary.length}</span> types</div>
            </div>
          )}
        </div>
      )}

      {/* Supply Chain Tree */}
      {tree && (
        <div style={{
          border: "1px solid rgba(255,71,0,0.15)",
          background: "#0a0a0a",
        }}>
          <div style={{
            padding: "8px 12px",
            borderBottom: "1px solid rgba(255,71,0,0.1)",
            fontSize: "9px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(255,71,0,0.5)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span>Supply Chain Tree</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => {
                  // Expand all nodes
                  const allKeys = new Set<string>();
                  function collectKeys(node: TreeNode) {
                    const k = `${node.depth}-${node.typeId}-${node.quantity}`;
                    allKeys.add(k);
                    node.children.forEach(collectKeys);
                  }
                  collectKeys(tree);
                  setExpanded(allKeys);
                }}
                style={{
                  background: "none", border: "1px solid rgba(255,71,0,0.2)",
                  color: "rgba(255,71,0,0.5)", fontSize: "9px", fontFamily: "inherit",
                  padding: "2px 8px", cursor: "pointer", letterSpacing: "0.08em",
                }}
              >
                Expand All
              </button>
              <button
                onClick={() => setExpanded(new Set())}
                style={{
                  background: "none", border: "1px solid rgba(255,71,0,0.2)",
                  color: "rgba(255,71,0,0.5)", fontSize: "9px", fontFamily: "inherit",
                  padding: "2px 8px", cursor: "pointer", letterSpacing: "0.08em",
                }}
              >
                Collapse All
              </button>
            </div>
          </div>
          <div style={{ padding: "8px 4px", maxHeight: "500px", overflowY: "auto" }}>
            <TreeRow node={tree} expanded={expanded} onToggle={handleToggle} />
          </div>
        </div>
      )}

      {/* Bottom panels: raw materials + time summary */}
      {tree && (
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>

          {/* Raw Materials Shopping List */}
          <div style={{
            flex: "1 1 300px",
            border: "1px solid rgba(100,100,100,0.3)",
            background: "#0a0a0a",
          }}>
            <div style={{
              padding: "8px 12px",
              borderBottom: "1px solid rgba(100,100,100,0.2)",
              fontSize: "9px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#aaaaaa",
              display: "flex",
              justifyContent: "space-between",
            }}>
              <span>🪨 Shopping List — Raw Materials</span>
              <span style={{ color: "rgba(180,160,140,0.4)" }}>{rawSummary.length} types</span>
            </div>
            <div style={{ maxHeight: "360px", overflowY: "auto" }}>
              {rawSummary.length === 0 ? (
                <div style={{ padding: "12px", fontSize: "11px", color: "rgba(180,160,140,0.4)" }}>
                  No raw materials — this item is already a base material.
                </div>
              ) : (
                rawSummary.map((item, i) => {
                  const colors = catStyle(item.category, true);
                  return (
                    <div
                      key={item.typeId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "5px 12px",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                        background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                      }}
                    >
                      <span style={{
                        fontSize: "10px",
                        fontFamily: "IBM Plex Mono, monospace",
                        color: "#FF4700",
                        fontWeight: 700,
                        minWidth: "60px",
                        textAlign: "right",
                      }}>
                        {item.totalQuantity.toLocaleString()}
                      </span>
                      <span style={{
                        flex: 1,
                        fontSize: "11px",
                        color: "rgba(200,180,160,0.8)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {item.name}
                      </span>
                      {item.category && (
                        <Badge label={item.category} colors={colors} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {rawSummary.length > 0 && (
              <div style={{
                padding: "8px 12px",
                borderTop: "1px solid rgba(100,100,100,0.2)",
                fontSize: "9px",
                color: "rgba(180,160,140,0.4)",
                display: "flex",
                justifyContent: "space-between",
              }}>
                <span>Total raw types</span>
                <span style={{ color: "#FF4700" }}>{rawSummary.length}</span>
              </div>
            )}
          </div>

          {/* Time Summary */}
          <div style={{
            flex: "0 1 220px",
            border: "1px solid rgba(255,71,0,0.15)",
            background: "#0a0a0a",
            alignSelf: "flex-start",
          }}>
            <div style={{
              padding: "8px 12px",
              borderBottom: "1px solid rgba(255,71,0,0.1)",
              fontSize: "9px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(255,71,0,0.5)",
            }}>
              ⏱ Manufacturing Time
            </div>
            <div style={{ padding: "8px 12px" }}>
              <div style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#FF4700",
                marginBottom: "12px",
              }}>
                {fmtTime(timeSummary.totalSeconds)}
              </div>
              {timeSummary.byDepth.map(row => (
                <div
                  key={row.depth}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "3px 0",
                    borderBottom: "1px solid rgba(255,71,0,0.05)",
                    fontSize: "10px",
                  }}
                >
                  <span style={{ color: "rgba(180,160,140,0.5)" }}>{row.label}</span>
                  <span style={{ color: "rgba(220,200,180,0.8)", fontFamily: "IBM Plex Mono, monospace" }}>
                    {fmtTime(row.seconds)}
                  </span>
                </div>
              ))}
              {timeSummary.totalSeconds === 0 && (
                <div style={{ fontSize: "11px", color: "rgba(180,160,140,0.4)" }}>
                  No manufacturing steps found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!tree && (
        <div style={{
          textAlign: "center",
          padding: "60px 24px",
          color: "rgba(107,107,94,0.4)",
          border: "1px solid rgba(255,71,0,0.06)",
          background: "#0a0a0a",
        }}>
          <div style={{ fontSize: "36px", marginBottom: "12px", opacity: 0.3 }}>⚙</div>
          <div style={{ fontSize: "13px", marginBottom: "6px" }}>Select a product to calculate its supply chain</div>
          <div style={{ fontSize: "11px", color: "rgba(107,107,94,0.35)" }}>
            {producibleTypeIds.size} buildable items across {Object.keys(blueprints).length} blueprints
          </div>
        </div>
      )}
    </div>
  );
}
