/**
 * PlaygroundHarness — UI exploration harness for CradleOS dashboard variants.
 *
 * Mounted by App.tsx when URL has ?playground=1 (or =A, =D, =AD).
 * Renders a navigation header to switch variants live, plus the selected
 * variant's view. All variants consume the same fixture data so visual
 * differences are purely design/layout.
 *
 * Variants:
 *   • current    — baseline (today's production layout)
 *   • D          — CCP token correction (Martian Red #FF2800 + Disket type)
 *   • A          — Tactical Status Rows (dense per-row layout)
 *   • AD         — A + D combined
 *
 * NOTE: this harness has zero impact on production. The production routes
 * never load these components.
 */

import { useState, useMemo } from "react";
import { FIXTURE_NODES, fixtureSummary } from "./fixture";
import { VariantCurrent } from "./VariantCurrent";
import { VariantD } from "./VariantD";
import { VariantA } from "./VariantA";
import { VariantAD } from "./VariantAD";

type Variant = "current" | "D" | "A" | "AD";

const VARIANTS: Array<{ key: Variant; label: string; tagline: string }> = [
  { key: "current", label: "CURRENT",       tagline: "production baseline" },
  { key: "D",       label: "VARIANT D",     tagline: "CCP color correction" },
  { key: "A",       label: "VARIANT A",     tagline: "tactical status rows" },
  { key: "AD",      label: "VARIANT A + D", tagline: "rows + ccp tokens" },
];

function pickInitialVariant(): Variant {
  const params = new URLSearchParams(window.location.search);
  const v = (params.get("playground") || "").toUpperCase();
  if (v === "D" || v === "A" || v === "AD") return v;
  return "current";
}

export function PlaygroundHarness() {
  const [variant, setVariant] = useState<Variant>(pickInitialVariant());

  const summary = useMemo(() => fixtureSummary(), []);
  const nodes = useMemo(() => FIXTURE_NODES, []);

  const current = VARIANTS.find(v => v.key === variant)!;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050505",
      color: "#FAFAE5",
      fontFamily: "var(--ccp-ds-font-disket)",
      padding: "24px 32px",
    }}>
      {/* Harness header */}
      <div style={{
        marginBottom: 24,
        paddingBottom: 14,
        borderBottom: "1px solid rgba(250,250,229,0.20)",
      }}>
        <div style={{
          fontFamily: "var(--ccp-ds-font-favorit)",
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: "#FF2800",
        }}>
          CRADLEOS · UI PLAYGROUND
        </div>
        <div style={{
          fontSize: 12,
          color: "rgba(250,250,229,0.60)",
          marginTop: 6,
          letterSpacing: "0.04em",
        }}>
          dashboard variants · hidden-systems view · 22 structures, 15 online,
          0 systems, 22 hidden · fixture data only — no live chain calls
        </div>
      </div>

      {/* Variant tabs */}
      <div style={{
        display: "flex",
        gap: 0,
        marginBottom: 28,
        borderBottom: "1px solid rgba(250,250,229,0.10)",
      }}>
        {VARIANTS.map(v => {
          const active = v.key === variant;
          return (
            <button
              key={v.key}
              onClick={() => {
                setVariant(v.key);
                const url = new URL(window.location.href);
                if (v.key === "current") url.searchParams.delete("playground");
                else url.searchParams.set("playground", v.key);
                window.history.replaceState({}, "", url.toString());
              }}
              style={{
                padding: "10px 18px",
                background: "transparent",
                color: active ? "#FF2800" : "rgba(250,250,229,0.60)",
                border: "none",
                borderBottom: active ? "2px solid #FF2800" : "2px solid transparent",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.08em",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              <span>{v.label}</span>
              <span style={{
                marginLeft: 10,
                fontSize: 11,
                fontWeight: 400,
                color: "rgba(250,250,229,0.40)",
                letterSpacing: "0.02em",
              }}>{v.tagline}</span>
            </button>
          );
        })}
      </div>

      {/* Note about the current variant */}
      <div style={{
        background: "rgba(255,40,0,0.05)",
        border: "1px solid rgba(255,40,0,0.20)",
        padding: "10px 14px",
        marginBottom: 24,
        fontSize: 12,
        color: "rgba(250,250,229,0.75)",
        lineHeight: 1.5,
      }}>
        ◆ <span style={{ color: "#FF2800", fontWeight: 700 }}>{current.label}</span>
        {" — "}{current.tagline}.
        Compare across tabs by clicking above.
      </div>

      {/* The selected variant */}
      <div>
        {variant === "current" && <VariantCurrent nodes={nodes} summary={summary} />}
        {variant === "D"       && <VariantD       nodes={nodes} summary={summary} />}
        {variant === "A"       && <VariantA       nodes={nodes} summary={summary} />}
        {variant === "AD"      && <VariantAD      nodes={nodes} summary={summary} />}
      </div>
    </div>
  );
}
