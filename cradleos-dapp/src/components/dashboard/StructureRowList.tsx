/**
 * StructureRowList — measured wrapper for a single node's structure rows.
 *
 * Owns the ResizeObserver that drives the density tier the wrapped rows
 * consume via DensityProvider. Each node gets its own observer so a node
 * column inside a multi-column dashboard layout sizes independently of
 * its siblings.
 */

import type { ReactNode } from "react";
import { DensityProvider, useContainerDensity } from "./useDensity";

export function StructureRowList({ children }: { children: ReactNode }) {
  const { ref, density } = useContainerDensity<HTMLDivElement>();
  return (
    <div ref={ref}>
      <DensityProvider value={density}>{children}</DensityProvider>
    </div>
  );
}
