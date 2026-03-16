import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MODULE_STATS } from "../moduleStats";
import { MODULE_ATTRIBUTES } from "../moduleAttributes";
import { MUNITION_STATS } from "../munitionStats";
import { WORLD_API } from "../constants";

// ─── Ship Data ───────────────────────────────────────────────────────────────

const SHIPS = [
  { id: 87698, name: "Wend",    className: "Shuttle",              slotsH: 1, slotsM: 3, slotsL: 0, cpu: 30,  pg: 30,   structureHP: 750,  shieldHP: 0,  armorHP: 0, maxVelocity: 260, mass: 6800000,    vel: 260, fuelCap: 200,    specificHeat: 2.5, fuelType: "basic" as const },
  { id: 87846, name: "Recurve", className: "Corvette",             slotsH: 2, slotsM: 3, slotsL: 1, cpu: 35,  pg: 50,   structureHP: 1650, shieldHP: 0,  armorHP: 0, maxVelocity: 405, mass: 10200000,   vel: 405, fuelCap: 970,    specificHeat: 1.0, fuelType: "basic" as const },
  { id: 87847, name: "Reflex",  className: "Corvette",             slotsH: 2, slotsM: 4, slotsL: 1, cpu: 32,  pg: 35,   structureHP: 1250, shieldHP: 0,  armorHP: 0, maxVelocity: 260, mass: 9750000,    vel: 260, fuelCap: 1750,   specificHeat: 3.0, fuelType: "basic" as const },
  { id: 87848, name: "Reiver",  className: "Corvette",             slotsH: 2, slotsM: 2, slotsL: 2, cpu: 35,  pg: 50,   structureHP: 1900, shieldHP: 0,  armorHP: 0, maxVelocity: 435, mass: 10400000,   vel: 435, fuelCap: 1416,   specificHeat: 1.0, fuelType: "basic" as const },
  { id: 81609, name: "USV",     className: "Frigate",              slotsH: 2, slotsM: 3, slotsL: 4, cpu: 30,  pg: 110,  structureHP: 2160, shieldHP: 0,  armorHP: 0, maxVelocity: 280, mass: 30266600,   vel: 280, fuelCap: 2420,   specificHeat: 1.8, fuelType: "advanced" as const },
  { id: 81904, name: "MCF",     className: "Frigate",              slotsH: 2, slotsM: 3, slotsL: 2, cpu: 60,  pg: 100,  structureHP: 2400, shieldHP: 0,  armorHP: 0, maxVelocity: 410, mass: 52313800,   vel: 410, fuelCap: 6548,   specificHeat: 2.5, fuelType: "advanced" as const },
  { id: 82424, name: "HAF",     className: "Frigate",              slotsH: 2, slotsM: 3, slotsL: 3, cpu: 45,  pg: 140,  structureHP: 2650, shieldHP: 0,  armorHP: 0, maxVelocity: 440, mass: 81883000,   vel: 440, fuelCap: 4184,   specificHeat: 2.5, fuelType: "advanced" as const },
  { id: 82426, name: "LORHA",   className: "Frigate",              slotsH: 0, slotsM: 2, slotsL: 4, cpu: 32,  pg: 110,  structureHP: 2155, shieldHP: 0,  armorHP: 0, maxVelocity: 450, mass: 42691300,   vel: 450, fuelCap: 2508,   specificHeat: 2.5, fuelType: "advanced" as const },
  { id: 81808, name: "TADES",   className: "Destroyer",            slotsH: 3, slotsM: 4, slotsL: 2, cpu: 125, pg: 280,  structureHP: 2600, shieldHP: 0,  armorHP: 0, maxVelocity: 420, mass: 74655504,   vel: 420, fuelCap: 5972,   specificHeat: 2.5, fuelType: "advanced" as const },
  { id: 82430, name: "MAUL",    className: "Cruiser",              slotsH: 4, slotsM: 3, slotsL: 3, cpu: 150, pg: 2450, structureHP: 4400, shieldHP: 0, armorHP: 0, maxVelocity: 400, mass: 548435968,  vel: 400, fuelCap: 24160,  specificHeat: 2.5, fuelType: "advanced" as const },
  { id: 81611, name: "Chumaq",  className: "Combat Battlecruiser", slotsH: 0, slotsM: 5, slotsL: 7, cpu: 145, pg: 2520, structureHP: 6250, shieldHP: 0, armorHP: 0, maxVelocity: 170, mass: 1487389952, vel: 170, fuelCap: 270585, specificHeat: 3.0, fuelType: "advanced" as const },
] as const;

type Ship = typeof SHIPS[number];

// ─── Module Types ─────────────────────────────────────────────────────────────

interface EFModule {
  id: number;
  name: string;
  groupName: string;
  mass: number;
  volume: number;
  slotType: "high" | "mid" | "low" | "engine";
}

/** Look up CPU/PG costs by module name (fuzzy: normalise to snake_case key). */
function lookupModuleStats(name: string): { cpu: number; pg: number } | null {
  // Try exact snake_case key first
  const key = name.toLowerCase().replace(/[^a-z0-9-]+/g, "_").replace(/^_|_$/g, "");
  if (MODULE_STATS[key]) return MODULE_STATS[key];
  // Try substring match on name field
  const entry = Object.values(MODULE_STATS).find(
    e => e.name.toLowerCase() === name.toLowerCase()
  );
  return entry ?? null;
}

/** Look up extended module attributes by module name (fuzzy: normalise to snake_case key). */
function lookupModuleAttributes(name: string): typeof MODULE_ATTRIBUTES[string] | null {
  // Try with hyphens preserved
  const keyHyphen = name.toLowerCase().replace(/[^a-z0-9-]+/g, "_").replace(/^_|_$/g, "");
  if (MODULE_ATTRIBUTES[keyHyphen]) return MODULE_ATTRIBUTES[keyHyphen];
  // Try with hyphens also collapsed to underscores (matches moduleAttributes.ts encoding)
  const keyFlat = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (MODULE_ATTRIBUTES[keyFlat]) return MODULE_ATTRIBUTES[keyFlat];
  // Fallback: name match
  return Object.values(MODULE_ATTRIBUTES).find(e => e.name?.toLowerCase() === name.toLowerCase()) ?? null;
}

/** Return compatible ammo list for a module (empty if not a weapon). */
function getCompatibleAmmo(moduleName: string): { key: string; name: string }[] {
  const attr = lookupModuleAttributes(moduleName);
  // Weapons: have rate_of_fire_s. Charge-based hardeners (Flex/Nanitic): have charge_size but no rof.
  if (!attr?.rate_of_fire_s && !attr?.charge_size) return [];
  const cat  = String((attr as Record<string, unknown>).category ?? (attr as Record<string, unknown>).group ?? "");
  const group = cat || String(attr.category ?? "");
  const size  = String(attr.charge_size ?? "");
  return Object.entries(MUNITION_STATS)
    .filter(([, a]) => a.used_with === group && (!size || a.charge_size === size))
    .map(([key, a]) => ({ key, name: String(a.name) }));
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Module API base — resolves to Utopia (hackathon build) or Stillness (CradleOS build) via VITE_SERVER_ENV
const FUEL_K = 1e-7;

const HIGH_GROUPS   = new Set(["Energy Lance", "Mass Driver Weapon", "Projectile Weapon", "Plasma Weapon", "Asteroid Mining Laser", "Crude Extractor"]);
// Mid: active/dynamic defense + ewar/propulsion — armor repairers, nanitic braces, shield modules all mid
const MID_GROUPS    = new Set(["Propulsion Module", "Warp Accelerator", "Stasis Web", "Warp Scrambler",
                               "Shield Recharger", "Shield Hardener",
                               "Armor Repair Unit", "Hull Repair Unit", "Nanitic Brace", "Flex Armor Hardener"]);
// Low: passive bulk + utility — armor plates, heat ejectors, cargo, hull repair
// Low: armor plates, shield generators, heat ejectors, cargo grids (all passive bulk/utility)
const LOW_GROUPS    = new Set(["Heat Ejector", "Expanded Cargohold", "Defensive System"]);
const ENGINE_GROUPS = new Set(["Crude Engines", "Hydrogen Engines"]);

function resolveSlotType(groupName: string, _name: string): "high" | "mid" | "low" | "engine" | null {
  if (ENGINE_GROUPS.has(groupName)) return "engine";
  if (HIGH_GROUPS.has(groupName)) return "high";
  if (MID_GROUPS.has(groupName))  return "mid";
  if (LOW_GROUPS.has(groupName))  return "low";
  return null;
}

function fuelLimitedRange(fuelUnits: number, quality: number, massKg: number): number {
  return (fuelUnits * quality) / (FUEL_K * massKg);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: {
    display: "flex",
    flexDirection: "column" as const,
    height: "calc(100vh - 160px)",
    minHeight: 500,
    maxHeight: "calc(100vh - 160px)",
    fontFamily: "monospace",
    fontSize: 12,
    color: "rgba(200,190,170,0.9)",
    background: "rgba(0,0,0,0.7)",
    overflow: "hidden" as const,
  },
  panelRow: {
    display: "flex",
    flexDirection: "row" as const,
    flex: 1,
    gap: 1,
    overflow: "hidden" as const,
    minHeight: 0,
  },
  panel: (width?: number | string) => ({
    background: "rgba(0,0,0,0.7)",
    border: "1px solid rgba(255,71,0,0.2)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    ...(typeof width === "number" ? { width, minWidth: width, maxWidth: width } : { flex: 1 }),
  }),
  panelHeader: {
    padding: "8px 10px",
    borderBottom: "1px solid rgba(255,71,0,0.2)",
    fontSize: 11,
    color: "#FF4700",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  muted: { color: "rgba(180,180,160,0.6)" },
  orange: { color: "#FF4700" },
  shipGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 4,
    padding: 8,
    overflowY: "auto" as const,
    flex: 1,
    alignContent: "start" as const,
  },
  shipCard: (active: boolean) => ({
    padding: "6px 8px",
    background: "rgba(0,0,0,0.5)",
    border: `1px solid ${active ? "#FF4700" : "rgba(255,71,0,0.2)"}`,
    cursor: "pointer",
    borderRadius: 0,
    transition: "border-color 0.1s",
    alignSelf: "start" as const,
    height: "fit-content",
    position: "relative" as const,
    overflow: "hidden",
  }),
  pill: (color: string) => ({
    display: "inline-block",
    background: `${color}22`,
    border: `1px solid ${color}55`,
    color: color,
    fontSize: 10,
    padding: "1px 4px",
    marginRight: 2,
    borderRadius: 0,
  }),
  slotColumns: {
    display: "flex",
    flexDirection: "row" as const,
    gap: 8,
    padding: "8px 10px",
    flex: 1,
    overflow: "auto",
    minHeight: 0,
  },
  slotColumn: {
    display: "flex",
    flexDirection: "column" as const,
    flex: 1,
    gap: 4,
  },
  slotColumnLabel: {
    fontSize: 10,
    color: "rgba(180,180,160,0.6)",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 4,
    borderBottom: "1px solid rgba(255,71,0,0.15)",
    paddingBottom: 3,
  },
  slotBox: (dragOver: boolean) => ({
    width: "100%",
    minHeight: 52,
    border: `1px solid ${dragOver ? "#FF4700" : "rgba(255,71,0,0.25)"}`,
    background: dragOver ? "rgba(255,71,0,0.08)" : "rgba(0,0,0,0.3)",
    borderRadius: 0,
    position: "relative" as const,
    padding: "4px 6px",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    cursor: "default",
    transition: "border-color 0.1s, background 0.1s",
  }),
  statsBar: {
    borderBottom: "1px solid rgba(255,71,0,0.2)",
    padding: "8px 14px",
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "12px 24px",
    background: "rgba(0,0,0,0.5)",
    flexShrink: 0,
  },
  statItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 1,
    minWidth: 64,
  },
  statLabel: {
    fontSize: 9,
    color: "rgba(180,180,160,0.6)",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  statBar: (pct: number) => {
    const color = pct <= 0.8 ? "#00ff96" : pct <= 1.0 ? "#ffd700" : "#ff4444";
    return {
      height: 3,
      background: `linear-gradient(to right, ${color} ${Math.min(pct * 100, 100)}%, rgba(255,255,255,0.1) ${Math.min(pct * 100, 100)}%)`,
      borderRadius: 0,
      marginTop: 2,
    };
  },
  filterTabs: {
    display: "flex",
    gap: 2,
    padding: "6px 8px",
    borderBottom: "1px solid rgba(255,71,0,0.2)",
  },
  filterTab: (active: boolean) => ({
    padding: "3px 8px",
    background: active ? "rgba(255,71,0,0.2)" : "transparent",
    border: `1px solid ${active ? "#FF4700" : "rgba(255,71,0,0.2)"}`,
    color: active ? "#FF4700" : "rgba(180,180,160,0.6)",
    fontSize: 11,
    cursor: "pointer",
    borderRadius: 0,
  }),
  searchBar: {
    padding: "4px 8px",
    borderBottom: "1px solid rgba(255,71,0,0.2)",
  },
  searchInput: {
    width: "100%",
    background: "rgba(0,0,0,0.5)",
    border: "1px solid rgba(255,71,0,0.25)",
    color: "rgba(200,190,170,0.9)",
    fontSize: 12,
    padding: "4px 6px",
    outline: "none",
    borderRadius: 0,
    boxSizing: "border-box" as const,
  },
  moduleList: {
    flex: 1,
    overflowY: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: 1,
    padding: "4px 6px",
  },
  moduleItem: (hovered: boolean) => ({
    padding: "5px 7px",
    background: hovered ? "rgba(255,71,0,0.1)" : "rgba(0,0,0,0.3)",
    border: `1px solid ${hovered ? "rgba(255,71,0,0.4)" : "rgba(255,71,0,0.15)"}`,
    cursor: "grab",
    borderRadius: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 1,
    userSelect: "none" as const,
  }),
  moduleDetail: {
    borderTop: "1px solid rgba(255,71,0,0.2)",
    padding: "8px 10px",
    maxHeight: 240,
    overflowY: "auto" as const,
    background: "rgba(0,0,0,0.4)",
    flexShrink: 0,
  },
  badge: (slotType: "high" | "mid" | "low" | "engine") => {
    const colors: Record<string, string> = { high: "#ff4444", mid: "#ffd700", low: "#00ff96", engine: "#a78bfa" };
    const color = colors[slotType] ?? "#888";
    return {
      display: "inline-block",
      background: `${color}22`,
      border: `1px solid ${color}55`,
      color,
      fontSize: 10,
      padding: "1px 5px",
      borderRadius: 0,
    };
  },
  clearBtn: {
    fontSize: 10,
    padding: "2px 8px",
    background: "rgba(255,71,0,0.1)",
    border: "1px solid rgba(255,71,0,0.4)",
    color: "#FF4700",
    cursor: "pointer",
    borderRadius: 0,
  },
  removeBtn: {
    position: "absolute" as const,
    top: 2,
    right: 4,
    background: "transparent",
    border: "none",
    color: "rgba(255,71,0,0.6)",
    cursor: "pointer",
    fontSize: 13,
    lineHeight: 1,
    padding: 0,
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatValue({ value, color }: { value: string; color?: string }) {
  return (
    <span style={{ fontSize: 12, color: color || "rgba(200,190,170,0.9)", fontWeight: "bold" }}>
      {value}
    </span>
  );
}


interface SlotBoxProps {
  slotKey: string;
  slotType: "high" | "mid" | "low" | "engine";
  module: EFModule | null;
  onDrop: (slotKey: string, moduleId: number, sourceSlot?: string | null) => void;
  onRemove: (slotKey: string) => void;
  onSlotDragStart: (e: React.DragEvent, slotKey: string, moduleId: number) => void;
  onSlotClick?: (slotKey: string) => void;
  isSelected?: boolean;
  compatibleAmmo?: { key: string; name: string }[];
  loadedAmmoKey?: string;
  onAmmoChange?: (slotKey: string, ammoKey: string) => void;
  isOnline?: boolean;
  onToggleOnline?: (slotKey: string) => void;
  isActive?: boolean;
  onToggleActive?: (slotKey: string) => void;
}

function SlotBox({ slotKey, slotType, module, onDrop, onRemove, onSlotDragStart, onSlotClick, isSelected, compatibleAmmo, loadedAmmoKey, onAmmoChange, isOnline = true, onToggleOnline, isActive = true, onToggleActive }: SlotBoxProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const moduleId = parseInt(e.dataTransfer.getData("moduleId"), 10);
    const sourceSlot = e.dataTransfer.getData("slotKey") || null;
    if (!isNaN(moduleId)) {
      onDrop(slotKey, moduleId, sourceSlot);
    }
  }, [slotKey, onDrop]);

  const slotTypeColors: Record<string, string> = { high: "#ff4444", mid: "#ffd700", low: "#00ff96", engine: "#a78bfa" };
  const typeColor = slotTypeColors[slotType];
  const isReplace = dragOver && !!module;

  return (
    <div
      draggable={!!module}
      onClick={() => { if (module && onSlotClick) onSlotClick(slotKey); }}
      style={{
        ...S.slotBox(dragOver),
        cursor: module ? "pointer" : "default",
        border: isSelected
          ? `1px solid ${typeColor}`
          : isReplace
          ? "1px solid #ff4444"
          : dragOver
            ? `1px solid ${typeColor}`
            : module
              ? `1px solid ${typeColor}55`
              : `1px dashed ${typeColor}44`,
        background: isSelected
          ? `${typeColor}18`
          : isReplace
          ? "rgba(255,68,68,0.1)"
          : dragOver
            ? `${typeColor}12`
            : module
              ? "rgba(0,0,0,0.5)"
              : "rgba(0,0,0,0.2)",
        outline: isSelected ? `1px solid ${typeColor}88` : undefined,
      }}
      onDragStart={module ? (e) => onSlotDragStart(e, slotKey, module.id) : undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={module ? "× to remove" : `Drop ${slotType} module here`}
    >
      {module ? (
        <div style={{ opacity: isOnline ? 1 : 0.4, width: "100%" }}>
          <button style={S.removeBtn} onClick={(e) => { e.stopPropagation(); onRemove(slotKey); }} title="Remove">×</button>
          {/* Online/Offline toggle */}
          {onToggleOnline && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleOnline(slotKey); }}
              title={isOnline ? "Take offline (disables CPU/PG + effects)" : "Bring online"}
              style={{ position: "absolute", top: 2, right: 18,
                       background: isOnline ? "rgba(0,255,150,0.12)" : "rgba(80,80,80,0.2)",
                       border: `1px solid ${isOnline ? "#00ff9655" : "#55555588"}`,
                       borderRadius: 3, cursor: "pointer", fontSize: 9, padding: "2px 4px", lineHeight: 1,
                       color: isOnline ? "#00ff96" : "#666", fontWeight: "bold", minWidth: 24, textAlign: "center" as const }}
            >
              {isOnline ? "ON" : "OFF"}
            </button>
          )}
          {/* Active/Inactive toggle — only shown when online */}
          {onToggleActive && isOnline && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleActive(slotKey); }}
              title={isActive ? "Deactivate (keep online, remove effects)" : "Activate"}
              style={{ position: "absolute", top: 18, right: 18,
                       background: isActive ? "rgba(255,160,50,0.15)" : "rgba(60,60,60,0.2)",
                       border: `1px solid ${isActive ? "#ffa03255" : "#44444488"}`,
                       borderRadius: 3, cursor: "pointer", fontSize: 9, padding: "2px 4px", lineHeight: 1,
                       color: isActive ? "#ffa032" : "#555", fontWeight: "bold", minWidth: 24, textAlign: "center" as const }}
            >
              {isActive ? "ACT" : "INA"}
            </button>
          )}
          <div style={{ fontSize: 12, fontWeight: "bold", paddingRight: 28, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {module.name}
          </div>
          <div style={{ fontSize: 10, color: `${typeColor}cc` }}>{module.groupName}</div>
          <div style={{ fontSize: 10, color: "rgba(180,180,160,0.4)" }}>{module.mass.toLocaleString()} kg</div>
          {compatibleAmmo && compatibleAmmo.length > 0 && (
            <select
              value={loadedAmmoKey ?? ""}
              onClick={e => e.stopPropagation()}
              onChange={e => { e.stopPropagation(); if (onAmmoChange) onAmmoChange(slotKey, e.target.value); }}
              style={{ marginTop: 4, width: "100%", fontSize: 9, background: "#111",
                       color: "rgba(200,190,170,0.9)", border: `1px solid ${typeColor}44`,
                       borderRadius: 2, padding: "1px 2px", cursor: "pointer" }}
            >
              <option value="">ammo: default</option>
              {compatibleAmmo.map(a => (
                <option key={a.key} value={a.key}>{a.name}</option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: dragOver ? 1 : 0.45 }}>
          <span style={{ fontSize: 18, color: typeColor, lineHeight: 1 }}>+</span>
          <span style={{ fontSize: 10, color: typeColor, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
            {slotType}
          </span>
        </div>
      )}
    </div>
  );
}

interface ModuleItemProps {
  module: EFModule;
  onDragStart: (e: React.DragEvent, moduleId: number) => void;
  onClick: (module: EFModule) => void;
  selected: boolean;
}

function ModuleItem({ module, onDragStart, onClick, selected }: ModuleItemProps) {
  const [hovered, setHovered] = useState(false);
  const slotColors: Record<string, string> = { high: "#ff4444", mid: "#ffd700", low: "#00ff96", engine: "#a78bfa" };
  const dotColor = slotColors[module.slotType] ?? "#888";

  return (
    <div
      style={S.moduleItem(hovered || selected)}
      draggable
      onDragStart={(e) => onDragStart(e, module.id)}
      onClick={() => onClick(module)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0, display: "inline-block" }} />
        <span style={{ fontSize: 12, fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {module.name}
        </span>
      </div>
      <div style={{ paddingLeft: 12, display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 10, color: `${dotColor}bb` }}>{module.groupName}</span>
        <span style={{ fontSize: 10, color: "rgba(180,180,160,0.4)" }}>{module.mass.toLocaleString()} kg</span>
      </div>
    </div>
  );
}

function getStatEffects(groupName: string): { label: string; value: string }[] {
  if (groupName.includes("Armor") && groupName.includes("Defensive")) return [{ label: "Armor HP", value: "(data pending)" }];
  if (groupName.includes("Shield") && groupName.includes("Defensive")) return [{ label: "Shield HP", value: "(data pending)" }];
  if (groupName === "Shield Recharger") return [{ label: "Shield HP", value: "(data pending)" }];
  if (groupName === "Propulsion Module" || groupName === "Crude Engines" || groupName === "Hydrogen Engines") return [{ label: "Velocity", value: "(data pending)" }];
  if (groupName === "Warp Accelerator") return [{ label: "Warp Speed", value: "(data pending)" }];
  if (["Energy Lance", "Projectile Weapon", "Plasma Weapon", "Mass Driver Weapon"].includes(groupName)) return [{ label: "DPS", value: "(data pending)" }];
  if (groupName === "Expanded Cargohold") return [{ label: "Cargo", value: "(data pending)" }];
  if (groupName === "Heat Ejector") return [{ label: "Heat Ejection Rate", value: "(data pending)" }];
  if (groupName === "Armor Repair Unit" || groupName === "Hull Repair Unit") return [{ label: "Active Repair", value: "(data pending)" }];
  if (["Shield Hardener", "Nanitic Brace", "Flex Armor Hardener"].includes(groupName)) return [{ label: "Resistance", value: "(data pending)" }];
  if (groupName === "Stasis Web" || groupName === "Warp Scrambler") return [{ label: "Target Debuff", value: "(data pending)" }];
  if (groupName === "Asteroid Mining Laser") return [{ label: "Mining Yield", value: "(data pending)" }];
  return [];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ShipFittingPanel() {
  const [selectedShip, setSelectedShip] = useState<Ship>(SHIPS[0]);
  const [fitted, setFitted] = useState<Record<string, EFModule | null>>({});
  const [loadedAmmo, setLoadedAmmo] = useState<Record<string, string>>({}); // slotKey → munition key
  const [onlineState, setOnlineState] = useState<Record<string, boolean>>({}); // slotKey → online (default true)
  const [activeState, setActiveState] = useState<Record<string, boolean>>({}); // slotKey → active (default true if online)
  const [modules, setModules] = useState<EFModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportExport, setShowImportExport] = useState(false);
  const [importText, setImportText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "high" | "mid" | "low" | "engines">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<EFModule | null>(null);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);
  const fetchAttempt = useRef(0);

  const MODULES_CACHE_KEY = `ef_modules_cache_v2_${WORLD_API.includes("stillness") ? "stillness" : "utopia"}`;
  const MODULES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  const parseModules = useCallback((raw: any[]): EFModule[] =>
    raw
      .filter((x: any) => x.categoryName === "Module")
      .map((x: any) => {
        const slotType = resolveSlotType(x.groupName ?? "", x.name ?? "");
        if (!slotType) return null;
        return { id: x.id as number, name: (x.name ?? "Unknown") as string,
                 groupName: (x.groupName ?? "") as string, mass: (x.mass ?? 0) as number,
                 volume: (x.volume ?? 0) as number, slotType } as EFModule;
      })
      .filter((m): m is EFModule => m !== null)
  , []);

  const fetchModules = useCallback(() => {
    // Try localStorage cache first
    try {
      const cached = localStorage.getItem(MODULES_CACHE_KEY);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < MODULES_CACHE_TTL && Array.isArray(data) && data.length > 0) {
          setModules(parseModules(data));
          setLoading(false);
          return; // served from cache
        }
      }
    } catch { /* ignore */ }

    setLoading(true);
    setError(null);
    fetchAttempt.current += 1;
    const attempt = fetchAttempt.current;
    fetch(`${WORLD_API}/v2/types?limit=500`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (attempt !== fetchAttempt.current) return;
        const raw: any[] = Array.isArray(d.data) ? d.data : [];
        // Cache the raw response
        try { localStorage.setItem(MODULES_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: raw })); } catch { /* ignore */ }
        setModules(parseModules(raw));
        setLoading(false);
      })
      .catch((err) => {
        if (attempt !== fetchAttempt.current) return;
        console.error("Module fetch error:", err);
        // Fall back to stale cache if available
        try {
          const cached = localStorage.getItem(MODULES_CACHE_KEY);
          if (cached) {
            const { data } = JSON.parse(cached);
            if (Array.isArray(data) && data.length > 0) {
              setModules(parseModules(data));
              setError("Modules loaded from cache (API offline).");
              setLoading(false);
              return;
            }
          }
        } catch { /* ignore */ }
        setError("Unable to load modules. Check connection.");
        setLoading(false);
      });
  }, [parseModules]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const moduleMap = useMemo(() => {
    const m: Record<number, EFModule> = {};
    modules.forEach((mod) => { m[mod.id] = mod; });
    return m;
  }, [modules]);

  const handleSelectShip = useCallback((ship: Ship) => {
    setSelectedShip(ship);
    setFitted({});
  }, []);

  const handleClearAll = useCallback(() => {
    setFitted({});
    setOnlineState({});
    setActiveState({});
    setLoadedAmmo({});
  }, []);

  const handleDrop = useCallback((slotKey: string, moduleId: number, sourceSlot?: string | null) => {
    const mod = moduleMap[moduleId];
    if (!mod) return;
    // Determine expected slot type from key prefix
    const prefix = slotKey[0].toLowerCase();
    const expectedType = prefix === "h" ? "high" : prefix === "m" ? "mid" : prefix === "e" ? "engine" : "low";
    if (mod.slotType !== expectedType) return;
    // Defensive System group cap: max 2 total across all low slots (armor + shield combined)
    if (mod.groupName === "Defensive System") {
      setFitted((prev) => {
        const next = sourceSlot ? { ...prev, [sourceSlot]: null } : { ...prev };
        // Count existing Defensive System modules excluding the target slot and source
        const defCount = Object.entries(next).filter(
          ([k, m]) => m?.groupName === "Defensive System" && k !== slotKey
        ).length;
        if (defCount >= 2) return prev; // cap hit — reject
        return { ...next, [slotKey]: mod };
      });
      return;
    }
    setFitted((prev) => {
      const next = sourceSlot ? { ...prev, [sourceSlot]: null } : { ...prev };
      return { ...next, [slotKey]: mod }; // replaces any existing module
    });
  }, [moduleMap]);

  const handleRemove = useCallback((slotKey: string) => {
    setFitted((prev) => ({ ...prev, [slotKey]: null }));
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, moduleId: number) => {
    e.dataTransfer.setData("moduleId", moduleId.toString());
    e.dataTransfer.setData("source", "browser");
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  // Drag start from a FITTED slot — mark source as rack
  const handleSlotDragStart = useCallback((e: React.DragEvent, slotKey: string, moduleId: number) => {
    e.dataTransfer.setData("moduleId", moduleId.toString());
    e.dataTransfer.setData("source", "rack");
    e.dataTransfer.setData("slotKey", slotKey);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleAmmoChange = useCallback((slotKey: string, ammoKey: string) => {
    setLoadedAmmo(prev => ({ ...prev, [slotKey]: ammoKey }));
  }, []);

  const handleToggleOnline = useCallback((slotKey: string) => {
    setOnlineState(prev => {
      const goingOffline = prev[slotKey] !== false; // currently online → going offline
      if (goingOffline) {
        // Taking offline also deactivates
        setActiveState(a => ({ ...a, [slotKey]: false }));
      }
      return { ...prev, [slotKey]: !goingOffline };
    });
  }, []);

  const handleToggleActive = useCallback((slotKey: string) => {
    // Cannot activate an offline module
    if (onlineState[slotKey] === false) return;
    setActiveState(prev => ({ ...prev, [slotKey]: prev[slotKey] === false ? true : false }));
  }, [onlineState]);

  // ── EFT Import / Export ────────────────────────────────────────────────────
  const exportFitting = useCallback(() => {
    const shipName = selectedShip.name.toUpperCase();
    const lines: string[] = [`[${shipName}, CradleOS Fitting]`];
    // EFT order: low → mid → high → engine, blank line between groups, then charges
    const _low  = Array.from({ length: selectedShip.slotsL }, (_, i) => `L${i}`);
    const _mid  = Array.from({ length: selectedShip.slotsM }, (_, i) => `M${i}`);
    const _high = Array.from({ length: selectedShip.slotsH }, (_, i) => `H${i}`);
    const lowMods  = _low.map(k  => fitted[k]?.name ?? "").filter(Boolean);
    const midMods  = _mid.map(k  => fitted[k]?.name ?? "").filter(Boolean);
    const highMods = _high.map(k => fitted[k]?.name ?? "").filter(Boolean);
    const engMod   = fitted["E0"]?.name;
    if (lowMods.length)  { lowMods.forEach(n  => lines.push(n)); lines.push(""); }
    if (midMods.length)  { midMods.forEach(n  => lines.push(n)); lines.push(""); }
    if (highMods.length) { highMods.forEach(n => lines.push(n)); lines.push(""); }
    if (engMod) { lines.push(engMod); lines.push(""); }
    // Ammo/charges loaded
    const charges: string[] = [];
    Object.entries(loadedAmmo).forEach(([, key]) => {
      if (key && MUNITION_STATS[key]) {
        const name = String(MUNITION_STATS[key].name);
        if (!charges.includes(name)) charges.push(`${name} x1`);
      }
    });
    charges.forEach(c => lines.push(c));
    return lines.join("\n").trim();
  }, [selectedShip, fitted, loadedAmmo]);

  const handleImport = useCallback((text: string, moduleList: EFModule[]) => {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    // Header: [SHIP_NAME, Fitting Name]
    const header = lines[0].match(/^\[([^,]+),/);
    if (header) {
      const shipName = header[1].trim();
      const ship = SHIPS.find(s => s.name.toUpperCase() === shipName.toUpperCase() || s.className.toUpperCase() === shipName.toUpperCase());
      if (ship) setSelectedShip(ship);
    }
    // Separate charge lines ("Name x<num>") from module lines
    const chargeLines = lines.slice(1).filter(l => /\bx\d+$/.test(l));
    const modLines    = lines.slice(1).filter(l => !/^\[/.test(l) && !/\bx\d+$/.test(l));

    // Build name→module map (lowercase, also strip trailing whitespace from EFT export quirks)
    const nameMap: Record<string, EFModule> = {};
    moduleList.forEach(m => { nameMap[m.name.toLowerCase().trim()] = m; });
    const resolvedMods = modLines
      .map(l => nameMap[l.toLowerCase().trim()] ?? null)
      .filter((m): m is EFModule => m !== null);

    // Fill slots: low → mid → high → engine (EFT order)
    const newFitted: Record<string, EFModule | null> = {};
    const lowSlotKeys  = Array.from({ length: 10 }, (_, i) => `L${i}`);
    const midSlotKeys  = Array.from({ length: 10 }, (_, i) => `M${i}`);
    const highSlotKeys = Array.from({ length: 10 }, (_, i) => `H${i}`);
    let li = 0, mi = 0, hi = 0;
    for (const mod of resolvedMods) {
      if      (mod.slotType === "low"    && li < 10) { newFitted[lowSlotKeys[li++]]  = mod; }
      else if (mod.slotType === "mid"    && mi < 10) { newFitted[midSlotKeys[mi++]]  = mod; }
      else if (mod.slotType === "high"   && hi < 10) { newFitted[highSlotKeys[hi++]] = mod; }
      else if (mod.slotType === "engine")             { newFitted["E0"]               = mod; }
    }

    // Parse charges → pre-load ammo into matching weapon slots
    const munitionNameMap: Record<string, string> = {}; // munition name (lower) → munitionStats key
    Object.entries(MUNITION_STATS).forEach(([key, a]) => {
      munitionNameMap[String(a.name).toLowerCase().trim()] = key;
    });
    const chargeKeys: string[] = chargeLines
      .map(l => { const name = l.replace(/\s*x\d+$/, "").trim().toLowerCase(); return munitionNameMap[name] ?? null; })
      .filter((k): k is string => k !== null);

    // Assign each charge to the first weapon slot whose group + charge_size matches
    const newAmmo: Record<string, string> = {};
    for (const chargeKey of chargeKeys) {
      const munition = MUNITION_STATS[chargeKey];
      // Find weapon slots that can use this charge
      for (const [slotKey, mod] of Object.entries(newFitted)) {
        if (!mod || newAmmo[slotKey]) continue; // already loaded
        const attr = lookupModuleAttributes(mod.name);
        if (!attr?.rate_of_fire_s) continue;
        const group = String(attr.category ?? "");
        const size  = String(attr.charge_size ?? "");
        if (munition.used_with === group && (!size || munition.charge_size === size)) {
          newAmmo[slotKey] = chargeKey;
        }
      }
    }

    setFitted(newFitted);
    setOnlineState({});
    setActiveState({});
    setLoadedAmmo(newAmmo);
    setShowImportExport(false);
    setImportText("");
  }, []);

  // Drop on a COLUMN — auto-snap to first empty slot of that type
  const handleColumnDrop = useCallback((e: React.DragEvent, slotType: "high" | "mid" | "low" | "engine", slotKeys: string[]) => {
    e.preventDefault();
    e.stopPropagation();
    const moduleId = parseInt(e.dataTransfer.getData("moduleId"), 10);
    const sourceSlot = e.dataTransfer.getData("slotKey");
    if (isNaN(moduleId)) return;
    const mod = moduleMap[moduleId];
    if (!mod || mod.slotType !== slotType) return;
    setFitted((prev) => {
      // If dragging from another rack slot, clear source first
      const next = sourceSlot ? { ...prev, [sourceSlot]: null } : { ...prev };
      // Find first empty slot in this column
      const target = slotKeys.find((k) => !next[k]);
      if (!target) return prev;
      return { ...next, [target]: mod };
    });
  }, [moduleMap]);

  // Drop on the MODULE BROWSER — remove the dragged rack module
  const handleBrowserDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const source = e.dataTransfer.getData("source");
    const slotKey = e.dataTransfer.getData("slotKey");
    if (source === "rack" && slotKey) {
      setFitted((prev) => ({ ...prev, [slotKey]: null }));
    }
  }, []);

  // Build slot keys for current ship
  const highSlots   = useMemo(() => Array.from({ length: selectedShip.slotsH }, (_, i) => `H${i}`), [selectedShip]);
  const midSlots    = useMemo(() => Array.from({ length: selectedShip.slotsM }, (_, i) => `M${i}`), [selectedShip]);
  const lowSlots    = useMemo(() => Array.from({ length: selectedShip.slotsL }, (_, i) => `L${i}`), [selectedShip]);
  const engineSlots = useMemo(() => ["E0"], []);  // All ships have exactly 1 engine slot

  // Stats
  const stats = useMemo(() => {
    const fittedMods = Object.values(fitted).filter((m): m is EFModule => m !== null);
    // Online: uses CPU/PG. Active (must be online): effects apply.
    const onlineMods = Object.entries(fitted)
      .filter(([k, m]) => m !== null && (onlineState[k] !== false))
      .map(([, m]) => m as EFModule);
    const isActive = (k: string) => onlineState[k] !== false && activeState[k] !== false;
    const modMass = fittedMods.reduce((sum, m) => sum + m.mass, 0);
    const totalMass = selectedShip.mass + modMass;
    const usedCpu = onlineMods.reduce((sum, m) => sum + (lookupModuleStats(m.name)?.cpu ?? 0), 0);
    const usedPg  = onlineMods.reduce((sum, m) => sum + (lookupModuleStats(m.name)?.pg  ?? 0), 0);
    const d1Range = fuelLimitedRange(selectedShip.fuelCap, 0.10, totalMass);
    const sof80Range = fuelLimitedRange(selectedShip.fuelCap, 0.80, totalMass);

    // ─── Computed combat stats ───────────────────────────────────────────────
    // DPS: damage fields damage_hp/em/thermal/kinetic/explosive + activation_time
    // DPS: weapon module × loaded ammo (or best default ammo for its charge_size + category)
    const getAmmoForSlot = (slotKey: string, attr: typeof MODULE_ATTRIBUTES[string]) => {
      const key = loadedAmmo[slotKey];
      if (key && MUNITION_STATS[key]) return MUNITION_STATS[key];
      // Default: first matching ammo by used_with group + charge_size
      const group = String(attr.category ?? "");
      const size  = String(attr.charge_size ?? "");
      return Object.values(MUNITION_STATS).find(
        a => a.used_with === group && (!size || a.charge_size === size)
      ) ?? null;
    };
    const weaponDps: { slotKey: string; dps: number; volley: number }[] = [];
    Object.entries(fitted).filter(([k]) => isActive(k)).forEach(([slotKey, m]) => {
      if (!m) return;
      const attr = lookupModuleAttributes(m.name);
      if (!attr || !attr.rate_of_fire_s) return;
      const rof = Number(attr.rate_of_fire_s);
      const dmgMod = Number(attr.damage_modifier_x ?? 1);
      const ammo = getAmmoForSlot(slotKey, attr);
      if (!ammo) return;
      const rawDmg = (Number(ammo.em_hp ?? 0) + Number(ammo.thermal_hp ?? 0) +
                      Number(ammo.kinetic_hp ?? 0) + Number(ammo.explosive_hp ?? 0));
      const volley = rawDmg * dmgMod;
      const dps = rof > 0 ? volley / rof : 0;
      weaponDps.push({ slotKey, dps, volley });
    });
    const totalDps = weaponDps.reduce((s, w) => s + w.dps, 0);
    const totalVolley = weaponDps.reduce((s, w) => s + w.volley, 0);

    // HP per layer (base + module bonuses)
    const hullHp = selectedShip.structureHP;
    const activeMods = Object.entries(fitted).filter(([k,m]) => m !== null && isActive(k)).map(([,m]) => m as EFModule);
    const armorHp = selectedShip.armorHP + activeMods.reduce((sum, m) => {
      const attr = lookupModuleAttributes(m.name);
      // real field: armor_hitpoint_bonus_hp
      return sum + Number(attr?.armor_hitpoint_bonus_hp ?? attr?.armor_hp_added ?? 0);
    }, 0);
    const shieldHp = selectedShip.shieldHP + activeMods.reduce((sum, m) => {
      const attr = lookupModuleAttributes(m.name);
      // real field: shield_hitpoint_bonus_hp
      return sum + Number(attr?.shield_hitpoint_bonus_hp ?? attr?.shield_capacity ?? attr?.shield_hp_added ?? 0);
    }, 0);

    // Repair rate (HP/s) — armor repairers
    const repairRate = activeMods.reduce((sum, m) => {
      const attr = lookupModuleAttributes(m.name);
      if (!attr) return sum;
      // real field: armor_hitpoints_repaired_hp
      const hp = Number(attr.armor_hitpoints_repaired_hp ?? attr.hp_repaired ?? attr.armor_hp_restored ?? 0);
      const t = Number(attr.activation_time_s ?? attr.activation_time_duration_s ?? 1);
      return sum + (t > 0 ? hp / t : 0);
    }, 0);

    // Max velocity: base * (1 + sum of maximum_velocity_bonus_pct/100)
    const velocityBonus = activeMods.reduce((sum, m) => {
      const attr = lookupModuleAttributes(m.name);
      // real field: maximum_velocity_bonus_pct
      return sum + Number(attr?.maximum_velocity_bonus_pct ?? attr?.velocity_bonus_pct ?? 0);
    }, 0);
    const maxVelocity = selectedShip.maxVelocity * (1 + velocityBonus / 100);

    return { fittedMods, modMass, totalMass, usedCpu, usedPg, d1Range, sof80Range,
             totalDps, totalVolley, weaponDps, hullHp, armorHp, shieldHp, repairRate, maxVelocity };
  }, [fitted, selectedShip, loadedAmmo, onlineState, activeState]);

  // Module filter
  const filteredModules = useMemo(() => {
    // Only show modules that can actually fit in at least one available slot on the selected ship
    const sH = selectedShip.slotsH as number;
    const sM = selectedShip.slotsM as number;
    const sL = selectedShip.slotsL as number;
    let list = modules.filter((m) => {
      if (m.slotType === "high"   && sH === 0) return false;
      if (m.slotType === "mid"    && sM === 0) return false;
      if (m.slotType === "low"    && sL === 0) return false;
      // Filter by can_be_fitted_to ship class restriction
      const attr = lookupModuleAttributes(m.name);
      if (attr?.can_be_fitted_to) {
        const allowed = String(attr.can_be_fitted_to).split(",").map(s => s.trim().toLowerCase());
        if (!allowed.includes(selectedShip.className.toLowerCase())) return false;
      }
      return true;
    });
    if (filterTab === "engines") {
      list = list.filter((m) => ENGINE_GROUPS.has(m.groupName));
    } else if (filterTab !== "all") {
      list = list.filter((m) => m.slotType === filterTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.groupName.toLowerCase().includes(q));
    }
    return list;
  }, [modules, filterTab, searchQuery, selectedShip]);

  return (
    <div style={S.root}>
      {/* ── Top Stats Bar ── */}
      {/* ── Stats Bars ── */}
      <div style={{ background: "rgba(0,0,0,0.5)", borderBottom: "1px solid rgba(255,71,0,0.2)", flexShrink: 0 }}>

        {/* ── Row 1: Fitting ── */}
        <div style={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid rgba(255,71,0,0.08)", minHeight: 44, alignItems: "stretch" }}>
          <div style={{ padding: "3px 10px 3px 14px", fontSize: 9, fontWeight: "bold", color: "#a78bfa", textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid rgba(167,139,250,0.2)", minWidth: 80, background: "rgba(167,139,250,0.06)" }}>Fitting</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 16px", padding: "2px 12px", alignItems: "flex-end", flex: 1 }}>
            <div style={S.statItem}>
              <span style={S.statLabel}>CPU</span>
              <div style={{ display: "flex", gap: 4, alignItems: "baseline" }}>
                <StatValue value={`${stats.usedCpu} tf`} color={stats.usedCpu > selectedShip.cpu ? "#ff4444" : stats.usedCpu > selectedShip.cpu * 0.9 ? "#ffa032" : undefined} />
                <span style={{ fontSize: 10, color: "rgba(180,180,160,0.4)" }}>/ {selectedShip.cpu}</span>
              </div>
              <div style={{ height: 2, marginTop: 2, background: "rgba(167,139,250,0.15)", width: 80 }}>
                <div style={{ height: "100%", width: `${Math.min(100,(stats.usedCpu/selectedShip.cpu)*100)}%`, background: stats.usedCpu > selectedShip.cpu ? "#ff4444" : "#a78bfa", transition: "width 0.2s" }} />
              </div>
            </div>
            <div style={S.statItem}>
              <span style={S.statLabel}>PG</span>
              <div style={{ display: "flex", gap: 4, alignItems: "baseline" }}>
                <StatValue value={`${stats.usedPg} MW`} color={stats.usedPg > selectedShip.pg ? "#ff4444" : stats.usedPg > selectedShip.pg * 0.9 ? "#ffa032" : undefined} />
                <span style={{ fontSize: 10, color: "rgba(180,180,160,0.4)" }}>/ {selectedShip.pg}</span>
              </div>
              <div style={{ height: 2, marginTop: 2, background: "rgba(167,139,250,0.15)", width: 80 }}>
                <div style={{ height: "100%", width: `${Math.min(100,(stats.usedPg/selectedShip.pg)*100)}%`, background: stats.usedPg > selectedShip.pg ? "#ff4444" : "#a78bfa", transition: "width 0.2s" }} />
              </div>
            </div>
            <div style={S.statItem}><span style={S.statLabel}>Modules</span><StatValue value={`${stats.fittedMods.length}`} /></div>
            <div style={S.statItem}><span style={S.statLabel}>Mass</span><StatValue value={`${(stats.totalMass/1e6).toFixed(1)} Mt`} /></div>
          </div>
        </div>

        {/* ── Row 2: Offense ── */}
        <div style={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid rgba(255,71,0,0.08)", minHeight: 44, alignItems: "stretch" }}>
          <div style={{ padding: "3px 10px 3px 14px", fontSize: 9, fontWeight: "bold", color: "#ff4444", textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid rgba(255,68,68,0.2)", minWidth: 80, background: "rgba(255,68,68,0.06)" }}>Offense</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 16px", padding: "2px 12px", alignItems: "flex-end", flex: 1 }}>
            <div style={S.statItem}><span style={S.statLabel}>DPS</span><StatValue value={stats.totalDps > 0 ? stats.totalDps.toFixed(1) : "—"} /></div>
            <div style={S.statItem}><span style={S.statLabel}>Volley</span><StatValue value={stats.totalVolley > 0 ? `${Math.round(stats.totalVolley)} HP` : "—"} /></div>
          </div>
        </div>

        {/* ── Row 3: Defense ── */}
        <div style={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid rgba(255,71,0,0.08)", minHeight: 44, alignItems: "stretch" }}>
          <div style={{ padding: "3px 10px 3px 14px", fontSize: 9, fontWeight: "bold", color: "#00ff96", textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid rgba(0,255,150,0.2)", minWidth: 80, background: "rgba(0,255,150,0.04)" }}>Defense</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 16px", padding: "2px 12px", alignItems: "flex-end", flex: 1 }}>
            <div style={S.statItem}><span style={S.statLabel}>Hull HP</span><StatValue value={stats.hullHp.toLocaleString()} /></div>
            {stats.armorHp > 0 && <div style={S.statItem}><span style={S.statLabel}>Armor HP</span><StatValue value={stats.armorHp.toLocaleString()} /></div>}
            {stats.shieldHp > 0 && <div style={S.statItem}><span style={S.statLabel}>Shield HP</span><StatValue value={stats.shieldHp.toLocaleString()} /></div>}
            {stats.repairRate > 0 && <div style={S.statItem}><span style={S.statLabel}>Repair</span><StatValue value={`${stats.repairRate.toFixed(1)} HP/s`} /></div>}
            {(() => {
              const raw: { em: number[]; thermal: number[]; kinetic: number[]; explosive: number[] } = { em: [], thermal: [], kinetic: [], explosive: [] };
              Object.entries(fitted).filter(([k]) => onlineState[k] !== false && activeState[k] !== false).forEach(([slotKey, m]) => {
                if (!m) return;
                const attr = lookupModuleAttributes(m.name);
                if (!attr) return;
                const cat = String((attr as Record<string,unknown>).category ?? (attr as Record<string,unknown>).group ?? "");
                if (cat === "Shield Hardener") {
                  const em = Math.abs(Number(attr.active_em_damage_resistance_pct ?? 0));
                  const th = Math.abs(Number(attr.active_thermal_damage_resistance_pct ?? 0));
                  const ki = Math.abs(Number(attr.active_kinetic_damage_resistance_pct ?? 0));
                  const ex = Math.abs(Number(attr.active_explosive_damage_resistance_pct ?? 0));
                  if (em > 0) raw.em.push(em); if (th > 0) raw.thermal.push(th); if (ki > 0) raw.kinetic.push(ki); if (ex > 0) raw.explosive.push(ex);
                } else if (cat === "Flex Armor Hardener" || cat === "Nanitic Brace") {
                  const chargeKey = loadedAmmo[slotKey];
                  const charge = chargeKey ? MUNITION_STATS[chargeKey] : null;
                  if (charge) {
                    const BASE_FLEX = 25;
                    const em  = Number(charge.em_resistance_mod        ?? 0) > 0 ? (Number(charge.em_resistance_mod)        / 100) * BASE_FLEX : 0;
                    const th  = Number(charge.thermal_resistance_mod   ?? 0) > 0 ? (Number(charge.thermal_resistance_mod)   / 100) * BASE_FLEX : 0;
                    const ki  = Number(charge.kinetic_resistance_mod   ?? 0) > 0 ? (Number(charge.kinetic_resistance_mod)   / 100) * BASE_FLEX : 0;
                    const ex  = Number(charge.explosive_resistance_mod ?? 0) > 0 ? (Number(charge.explosive_resistance_mod) / 100) * BASE_FLEX : 0;
                    if (em > 0) raw.em.push(em); if (th > 0) raw.thermal.push(th); if (ki > 0) raw.kinetic.push(ki); if (ex > 0) raw.explosive.push(ex);
                  }
                } else if (cat === "Defensive System") {
                  const em = Math.abs(Number(attr.active_em_damage_resistance_pct ?? 0));
                  const th = Math.abs(Number(attr.active_thermal_damage_resistance_pct ?? 0));
                  const ki = Math.abs(Number(attr.active_kinetic_damage_resistance_pct ?? 0));
                  const ex = Math.abs(Number(attr.active_explosive_damage_resistance_pct ?? 0));
                  if (em > 0) raw.em.push(em); if (th > 0) raw.thermal.push(th); if (ki > 0) raw.kinetic.push(ki); if (ex > 0) raw.explosive.push(ex);
                }
              });
              const stackedResist = (values: number[]): number => {
                if (!values.length) return 0;
                const sorted = [...values].sort((a, b) => b - a);
                const rem = sorted.reduce((prod, v, i) => prod * (1 - (v / 100) * Math.exp(-Math.pow(i / 2.67, 2))), 1);
                return (1 - rem) * 100;
              };
              const res = { em: stackedResist(raw.em), thermal: stackedResist(raw.thermal), kinetic: stackedResist(raw.kinetic), explosive: stackedResist(raw.explosive) };
              const any = res.em + res.thermal + res.kinetic + res.explosive > 0;
              if (!any) return null;
              return [
                { key: "em", label: "EM", val: res.em, color: "#6a9ee8" },
                { key: "thermal", label: "Therm", val: res.thermal, color: "#e8662a" },
                { key: "kinetic", label: "Kin", val: res.kinetic, color: "#8ea8a0" },
                { key: "explosive", label: "Exp", val: res.explosive, color: "#e8a030" },
              ].filter(r => r.val > 0).map(r => (
                <div key={r.key} style={{ ...S.statItem, minWidth: 60 }}>
                  <span style={S.statLabel}>{r.label} Res</span>
                  <span style={{ fontSize: 13, fontWeight: "bold", color: r.color }}>{r.val.toFixed(0)}%</span>
                  <div style={{ height: 2, marginTop: 2, background: "rgba(255,255,255,0.08)", width: 60 }}>
                    <div style={{ height: "100%", width: `${Math.min(100,r.val)}%`, background: r.color, opacity: 0.85 }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* ── Row 4: Navigation ── */}
        <div style={{ display: "flex", flexWrap: "wrap", minHeight: 44, alignItems: "stretch" }}>
          <div style={{ padding: "3px 10px 3px 14px", fontSize: 9, fontWeight: "bold", color: "#ffd700", textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid rgba(255,215,0,0.2)", minWidth: 80, background: "rgba(255,215,0,0.04)" }}>NAVIGATION</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 16px", padding: "2px 12px", alignItems: "flex-end", flex: 1 }}>
            <div style={S.statItem}><span style={S.statLabel}>Max Vel</span><StatValue value={`${stats.maxVelocity.toFixed(0)} m/s`} /></div>
            <div style={S.statItem}><span style={S.statLabel}>Jump (D1)</span><StatValue value={`${stats.d1Range.toFixed(1)} AU`} /></div>
            {selectedShip.fuelType === "advanced" && <div style={S.statItem}><span style={S.statLabel}>Jump (SOF-80)</span><StatValue value={`${stats.sof80Range.toFixed(1)} AU`} /></div>}
          </div>
        </div>

      </div>

      {/* ── Panels Row ── */}
      <div style={S.panelRow}>
      {/* ── Panel 1: Ship Selector ── */}
      <div style={S.panel(220)}>
        <div style={S.panelHeader}>
          <span>Ships</span>
        </div>
        <div style={S.shipGrid}>
          {SHIPS.map((ship) => (
            <div
              key={ship.id}
              style={S.shipCard(selectedShip.id === ship.id)}
              onClick={() => handleSelectShip(ship)}
            >
              {/* Ship class render — faint background art */}
              {(() => {
                const classMap: Record<string, string> = {
                  "Shuttle": "/game-ship-shuttle.png",
                  "Corvette": "/game-ship-corvette.png",
                  "Frigate": "/game-ship-frigate.png",
                  "Destroyer": "/game-ship-destroyer.png",
                  "Cruiser": "/game-ship-cruiser.png",
                  "Combat Battlecruiser": "/game-ship-battlecruiser.png",
                };
                const src = classMap[ship.className];
                return src ? (
                  <div style={{ position: "absolute", right: 0, bottom: 0, width: 48, height: 48,
                    backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center",
                    opacity: selectedShip.id === ship.id ? 0.25 : 0.12,
                    borderRadius: "0 0 0 0", pointerEvents: "none" }} />
                ) : null;
              })()}
              <div style={{ fontWeight: "bold", fontSize: 12, marginBottom: 2, position: "relative" }}>{ship.name}</div>
              <div style={{ ...S.muted, fontSize: 10, marginBottom: 4, position: "relative" }}>{ship.className}</div>
              <div>
                <span style={S.pill("#ff4444")}>H:{ship.slotsH}</span>
                <span style={S.pill("#ffd700")}>M:{ship.slotsM}</span>
                <span style={S.pill("#00ff96")}>L:{ship.slotsL}</span>
                <span style={S.pill("#a78bfa")}>E:1</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Panel 2: Fitting Rack ── */}
      <div style={S.panel()}>
        <div style={S.panelHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: "bold", color: "rgba(200,190,170,0.9)" }}>{selectedShip.name}</span>
            <span style={{ ...S.muted, fontSize: 11 }}>{selectedShip.className}</span>
            {!fitted["E0"] && (
              <span style={{ fontSize: 10, color: "#a78bfa", border: "1px solid #a78bfa55", padding: "1px 6px", background: "rgba(167,139,250,0.08)" }}>
                NO ENGINE
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={S.clearBtn} onClick={() => { setImportText(exportFitting()); setShowImportExport(true); }}>Export</button>
            <button style={S.clearBtn} onClick={() => { setImportText(""); setShowImportExport(true); }}>Import</button>
            <button style={S.clearBtn} onClick={handleClearAll}>Clear</button>
          </div>
        </div>
        {showImportExport && (
          <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,71,0,0.15)", background: "rgba(0,0,0,0.3)" }}>
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              rows={8}
              style={{ width: "100%", fontFamily: "monospace", fontSize: 11, background: "#111",
                       color: "rgba(200,190,170,0.9)", border: "1px solid rgba(255,71,0,0.25)",
                       borderRadius: 3, padding: "6px", resize: "vertical", boxSizing: "border-box" }}
              placeholder={"[SHIP NAME, Fitting Name]\nModule1\nModule2\n..."}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                style={{ ...S.clearBtn, background: "rgba(255,71,0,0.15)", color: "#FF4700" }}
                onClick={() => handleImport(importText, modules)}
              >Load Fitting</button>
              <button style={S.clearBtn} onClick={() => { navigator.clipboard?.writeText(importText); }}>Copy</button>
              <button style={S.clearBtn} onClick={() => setShowImportExport(false)}>Close</button>
            </div>
          </div>
        )}

        {/* Panel 2 inner: slots + stats sidebar */}
        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <div style={{ ...S.slotColumns, flex: 1, overflowY: "auto" }}>
          {/* HIGH — hidden if ship has no high slots */}
          {(selectedShip.slotsH as number) > 0 && (
            <div
              style={S.slotColumn}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleColumnDrop(e, "high", highSlots)}
            >
              <div style={S.slotColumnLabel}>
                High <span style={{ color: "#ff4444", marginLeft: 4 }}>
                  {highSlots.filter(k => fitted[k]).length}/{highSlots.length}
                </span>
              </div>
              {highSlots.map((k) => (
                <SlotBox
                  key={k}
                  slotKey={k}
                  slotType="high"
                  module={fitted[k] ?? null}
                  onDrop={handleDrop}
                  onRemove={handleRemove}
                  onSlotDragStart={handleSlotDragStart}
                  onSlotClick={setSelectedSlotKey}
                  isSelected={selectedSlotKey === k}
                  compatibleAmmo={fitted[k] ? getCompatibleAmmo(fitted[k]!.name) : []}
                  loadedAmmoKey={loadedAmmo[k]}
                  onAmmoChange={handleAmmoChange}
                  isOnline={onlineState[k] !== false}
                  onToggleOnline={handleToggleOnline}
                  isActive={onlineState[k] !== false && activeState[k] !== false}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          )}
          {/* MID — hidden if ship has no mid slots */}
          {(selectedShip.slotsM as number) > 0 && (
            <div
              style={S.slotColumn}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleColumnDrop(e, "mid", midSlots)}
            >
              <div style={S.slotColumnLabel}>
                Mid <span style={{ color: "#ffd700", marginLeft: 4 }}>
                  {midSlots.filter(k => fitted[k]).length}/{midSlots.length}
                </span>
              </div>
              {midSlots.map((k) => (
                <SlotBox
                  key={k}
                  slotKey={k}
                  slotType="mid"
                  module={fitted[k] ?? null}
                  onDrop={handleDrop}
                  onRemove={handleRemove}
                  onSlotDragStart={handleSlotDragStart}
                  onSlotClick={setSelectedSlotKey}
                  isSelected={selectedSlotKey === k}
                  compatibleAmmo={fitted[k] ? getCompatibleAmmo(fitted[k]!.name) : []}
                  loadedAmmoKey={loadedAmmo[k]}
                  onAmmoChange={handleAmmoChange}
                  isOnline={onlineState[k] !== false}
                  onToggleOnline={handleToggleOnline}
                  isActive={onlineState[k] !== false && activeState[k] !== false}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          )}
          {/* LOW — hidden if ship has no low slots */}
          {(selectedShip.slotsL as number) > 0 && (
            <div
              style={S.slotColumn}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleColumnDrop(e, "low", lowSlots)}
            >
              <div style={S.slotColumnLabel}>
                Low <span style={{ color: "#00ff96", marginLeft: 4 }}>
                  {lowSlots.filter(k => fitted[k]).length}/{lowSlots.length}
                </span>
                {(() => {
                  const defCount = Object.values(fitted).filter(m => m?.groupName === "Defensive System").length;
                  return defCount > 0 ? (
                    <span style={{ color: defCount >= 2 ? "#ff4444" : "rgba(0,255,150,0.55)", fontSize: 9, marginLeft: 6 }}>
                      def {defCount}/2
                    </span>
                  ) : null;
                })()}
              </div>
              {lowSlots.map((k) => (
                <SlotBox
                  key={k}
                  slotKey={k}
                  slotType="low"
                  module={fitted[k] ?? null}
                  onDrop={handleDrop}
                  onRemove={handleRemove}
                  onSlotDragStart={handleSlotDragStart}
                  onSlotClick={setSelectedSlotKey}
                  isSelected={selectedSlotKey === k}
                  compatibleAmmo={fitted[k] ? getCompatibleAmmo(fitted[k]!.name) : []}
                  loadedAmmoKey={loadedAmmo[k]}
                  onAmmoChange={handleAmmoChange}
                  isOnline={onlineState[k] !== false}
                  onToggleOnline={handleToggleOnline}
                  isActive={onlineState[k] !== false && activeState[k] !== false}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          )}
        </div>{/* end slot columns */}

        </div>{/* end Panel 2 inner flex row */}

        {/* ENGINE — pinned bottom strip, always visible */}
        <div
          style={{ borderTop: "1px solid rgba(167,139,250,0.2)", background: "rgba(167,139,250,0.04)",
                   padding: "6px 10px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleColumnDrop(e, "engine", engineSlots)}
        >
          <span style={{ fontSize: 9, fontWeight: "bold", color: "#a78bfa", textTransform: "uppercase", letterSpacing: 1, minWidth: 46 }}>Engine</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {engineSlots.map((k) => (
              <SlotBox
                key={k}
                slotKey={k}
                slotType="engine"
                module={fitted[k] ?? null}
                onDrop={handleDrop}
                onRemove={handleRemove}
                onSlotDragStart={handleSlotDragStart}
                onSlotClick={setSelectedSlotKey}
                isSelected={selectedSlotKey === k}
                compatibleAmmo={fitted[k] ? getCompatibleAmmo(fitted[k]!.name) : []}
                loadedAmmoKey={loadedAmmo[k]}
                onAmmoChange={handleAmmoChange}
                isOnline={onlineState[k] !== false}
                onToggleOnline={handleToggleOnline}
                isActive={onlineState[k] !== false && activeState[k] !== false}
                onToggleActive={handleToggleActive}
              />
            ))}
            {!fitted["E0"] && (
              <span style={{ fontSize: 10, color: "rgba(167,139,250,0.5)" }}>Required for jump — drag from ENGINES tab</span>
            )}
          </div>
        </div>

      </div>

      {/* ── Panel 3: Module Browser — also acts as remove zone for fitted modules ── */}
      <div
        style={S.panel(300)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleBrowserDrop}
      >
        <div style={S.panelHeader}>
          <span>Module Browser</span>
          {!loading && !error && (
            <span style={{ ...S.muted, fontSize: 10 }}>{modules.length} modules</span>
          )}
        </div>

        {/* Filter Tabs */}
        <div style={S.filterTabs}>
          {(["all", "high", "mid", "low", "engines"] as const).map((tab) => (
            <button
              key={tab}
              style={S.filterTab(filterTab === tab)}
              onClick={() => setFilterTab(tab)}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={S.searchBar}>
          <input
            style={S.searchInput}
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Module List */}
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", ...S.muted }}>
            Loading module database...
          </div>
        ) : error ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <span style={{ color: "#ff4444", fontSize: 12, textAlign: "center", padding: "0 12px" }}>{error}</span>
            <button
              style={{ ...S.clearBtn, fontSize: 11 }}
              onClick={fetchModules}
            >
              Retry
            </button>
          </div>
        ) : (
          <div style={S.moduleList}>
            {filteredModules.length === 0 ? (
              <div style={{ ...S.muted, fontSize: 11, padding: 8 }}>No modules found.</div>
            ) : (
              filteredModules.map((mod) => (
                <ModuleItem
                  key={mod.id}
                  module={mod}
                  onDragStart={handleDragStart}
                  onClick={setSelectedModule}
                  selected={selectedModule?.id === mod.id}
                />
              ))
            )}
          </div>
        )}

        {/* Module Detail */}
        {selectedModule && (
          <div style={S.moduleDetail}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <span style={{ fontWeight: "bold", fontSize: 13 }}>{selectedModule.name}</span>
              <span style={S.badge(selectedModule.slotType)}>{selectedModule.slotType.toUpperCase()}</span>
            </div>
            <div style={{ ...S.muted, fontSize: 11, marginBottom: 6 }}>{selectedModule.groupName}</div>
            <div style={{ fontSize: 11, marginBottom: 2 }}>
              <span style={S.muted}>Mass: </span>
              <span>{selectedModule.mass.toLocaleString()} kg</span>
            </div>
            <div style={{ fontSize: 11, marginBottom: 8 }}>
              <span style={S.muted}>Volume: </span>
              <span>{selectedModule.volume.toLocaleString()} m³</span>
            </div>
            <div style={{ fontSize: 10, color: "#FF4700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
              Stat Effects
            </div>
            <div style={{ fontSize: 11, marginBottom: 4 }}>
              <span style={S.muted}>cpu cost: </span>
              {(() => { const s = lookupModuleStats(selectedModule.name); return s ? `${s.cpu} tf` : <span style={{ color: "rgba(107,107,94,0.45)" }}>N/A</span>; })()}
            </div>
            <div style={{ fontSize: 11, marginBottom: 4 }}>
              <span style={S.muted}>pg cost: </span>
              {(() => { const s = lookupModuleStats(selectedModule.name); return s ? `${s.pg} MW` : <span style={{ color: "rgba(107,107,94,0.45)" }}>N/A</span>; })()}
            </div>
            <div style={{ fontSize: 11, marginBottom: 4 }}>
              <span style={S.muted}>Mass impact: </span>
              +{selectedModule.mass.toLocaleString()} kg
            </div>
            {getStatEffects(selectedModule.groupName).map((effect) => (
              <div key={effect.label} style={{ fontSize: 11, marginBottom: 2 }}>
                <span style={S.muted}>{effect.label}: </span>
                <span style={{ color: "rgba(180,180,160,0.5)" }}>{effect.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>{/* end panelRow */}
    </div>
  );
}
