/**
 * useDensity — flexible row-density layout for StructureRow / StructureRowHeader.
 *
 * Why container-queries: CradleOS is rendered both as a desktop dApp and inside
 * the EVE Frontier in-game browser, where the available width is dictated by
 * the game's panel layout — not the OS window. So we measure the *list*
 * container with ResizeObserver and emit a density tier the rows consume.
 *
 * Tiers:
 *   - "wide"    ≥ 720px: full layout, all columns
 *   - "normal"  520-719px: compressed STATUS column, ID still shown
 *   - "compact" 360-519px: drop OBJ ID column, hide secondary action labels
 *   - "tiny"    < 360px: also drop EP column, icon-only EDIT
 *
 * The grid templates are exported so StructureRow and StructureRowHeader stay
 * in lockstep; mismatched templates are a leading cause of "bleeding" layout.
 */

import { createContext, useContext, useEffect, useRef, useState, type RefObject } from "react";

export type Density = "tiny" | "compact" | "normal" | "wide";

const DensityContext = createContext<Density>("wide");

export const DensityProvider = DensityContext.Provider;
export function useDensity(): Density {
  return useContext(DensityContext);
}

/**
 * Attach a ResizeObserver to a container ref and derive the current density
 * tier from its width. Returns the tier and a stable ref to attach.
 */
export function useContainerDensity<T extends HTMLElement>(): {
  ref: RefObject<T | null>;
  density: Density;
} {
  const ref = useRef<T | null>(null);
  const [density, setDensity] = useState<Density>("wide");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const compute = (w: number): Density => {
      if (w < 360) return "tiny";
      if (w < 520) return "compact";
      if (w < 720) return "normal";
      return "wide";
    };

    const apply = (w: number) => {
      const next = compute(w);
      setDensity(prev => (prev === next ? prev : next));
    };

    apply(el.getBoundingClientRect().width);

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        // Use contentBoxSize when available (more accurate w/ scrollbars)
        const cbs = entry.contentBoxSize;
        if (cbs && cbs.length > 0) {
          const inline = Array.isArray(cbs) ? cbs[0].inlineSize : (cbs as any).inlineSize;
          apply(inline);
        } else {
          apply(entry.contentRect.width);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, density };
}

/**
 * The single source of truth for grid columns at each density tier.
 * Keep StructureRow and StructureRowHeader using `gridTemplateFor(density)`.
 *
 * Columns left→right: [icon, name, EP, OBJ ID, status·actions]
 * `minmax(0, …)` is critical so the NAME column can actually shrink with
 * text-overflow: ellipsis instead of being forced to its content width.
 */
export function gridTemplateFor(density: Density): string {
  switch (density) {
    case "tiny":
      // icon | name | (no EP, no OBJ ID) | actions
      return "24px minmax(0,1fr) 0px 0px 110px";
    case "compact":
      // icon | name | EP | (no OBJ ID) | actions
      return "28px minmax(0,1fr) 64px 0px 150px";
    case "normal":
      // icon | name | EP | OBJ ID | actions (compressed)
      return "32px minmax(0,1fr) 70px 70px 220px";
    case "wide":
    default:
      // Original full layout
      return "32px minmax(0,1fr) 90px 90px 320px";
  }
}

/** Shows or hides the OBJ ID column at the current density. */
export function showObjId(d: Density): boolean {
  return d === "normal" || d === "wide";
}
/** Shows or hides the EP column at the current density. */
export function showEp(d: Density): boolean {
  return d !== "tiny";
}
/** Whether secondary action labels should collapse to icon-only. */
export function compactActions(d: Density): boolean {
  return d === "tiny" || d === "compact";
}

/** Row-level padding shrinks with density to give the NAME column room. */
export function rowPaddingFor(density: Density): string {
  switch (density) {
    case "tiny":    return "8px 8px";
    case "compact": return "8px 10px";
    case "normal":  return "8px 14px";
    case "wide":
    default:        return "9px 18px";
  }
}

/** Inter-column gap shrinks with density. */
export function rowGapFor(density: Density): number {
  switch (density) {
    case "tiny":    return 4;
    case "compact": return 6;
    case "normal":  return 8;
    case "wide":
    default:        return 12;
  }
}
