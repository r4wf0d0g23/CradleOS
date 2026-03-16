/**
 * StructureIcon — geometric line-art SVG icons matching the CradleOS terminal aesthetic.
 * All icons use the #FF4700 / rgba(255,71,0,x) color language.
 */

type IconProps = { size?: number; opacity?: number; color?: string };

export function TurretIcon({ size = 18, opacity = 0.7, color = "#FF4700" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" style={{ opacity, flexShrink: 0 }}>
      {/* Targeting reticle with barrel */}
      <circle cx="9" cy="9" r="7" stroke={color} strokeWidth="1" />
      <circle cx="9" cy="9" r="3" stroke={color} strokeWidth="1" />
      {/* Crosshairs */}
      <line x1="9" y1="2" x2="9" y2="5.5" stroke={color} strokeWidth="1" />
      <line x1="9" y1="12.5" x2="9" y2="16" stroke={color} strokeWidth="1" />
      <line x1="2" y1="9" x2="5.5" y2="9" stroke={color} strokeWidth="1" />
      <line x1="12.5" y1="9" x2="16" y2="9" stroke={color} strokeWidth="1" />
      {/* Barrel pointing up */}
      <rect x="8" y="0" width="2" height="3" fill={color} />
    </svg>
  );
}

export function GateIcon({ size = 18, opacity = 0.7, color = "#FF4700" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" style={{ opacity, flexShrink: 0 }}>
      {/* Two vertical pillars */}
      <rect x="2" y="3" width="3" height="12" stroke={color} strokeWidth="1" fill="none" />
      <rect x="13" y="3" width="3" height="12" stroke={color} strokeWidth="1" fill="none" />
      {/* Arch connecting them at top */}
      <path d="M5 3 Q9 0 13 3" stroke={color} strokeWidth="1" fill="none" />
      {/* Energy field / warp line through gate center */}
      <line x1="5" y1="9" x2="13" y2="9" stroke={color} strokeWidth="1" strokeDasharray="2 1.5" />
      {/* Small nodes at pillar tops */}
      <rect x="2.5" y="2" width="2" height="2" fill={color} />
      <rect x="13.5" y="2" width="2" height="2" fill={color} />
    </svg>
  );
}

export function SSUIcon({ size = 18, opacity = 0.7, color = "#FF4700" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" style={{ opacity, flexShrink: 0 }}>
      {/* Main container */}
      <rect x="3" y="4" width="12" height="10" stroke={color} strokeWidth="1" fill="none" />
      {/* Internal grid — 3 cells */}
      <line x1="7" y1="4" x2="7" y2="14" stroke={color} strokeWidth="0.75" />
      <line x1="11" y1="4" x2="11" y2="14" stroke={color} strokeWidth="0.75" />
      <line x1="3" y1="9" x2="15" y2="9" stroke={color} strokeWidth="0.75" />
      {/* Connector ports top */}
      <line x1="6" y1="2" x2="6" y2="4" stroke={color} strokeWidth="1" />
      <line x1="9" y1="2" x2="9" y2="4" stroke={color} strokeWidth="1" />
      <line x1="12" y1="2" x2="12" y2="4" stroke={color} strokeWidth="1" />
    </svg>
  );
}

export function AssemblyIcon({ size = 18, opacity = 0.7, color = "#FF4700" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" style={{ opacity, flexShrink: 0 }}>
      {/* Central hub */}
      <circle cx="9" cy="9" r="3" stroke={color} strokeWidth="1" fill="none" />
      {/* 4 arms with endpoints */}
      <line x1="9" y1="6" x2="9" y2="2" stroke={color} strokeWidth="1" />
      <line x1="9" y1="12" x2="9" y2="16" stroke={color} strokeWidth="1" />
      <line x1="6" y1="9" x2="2" y2="9" stroke={color} strokeWidth="1" />
      <line x1="12" y1="9" x2="16" y2="9" stroke={color} strokeWidth="1" />
      {/* Endpoint nodes */}
      <rect x="7.5" y="1" width="3" height="2" fill={color} />
      <rect x="7.5" y="15" width="3" height="2" fill={color} />
      <rect x="1" y="7.5" width="2" height="3" fill={color} />
      <rect x="15" y="7.5" width="2" height="3" fill={color} />
    </svg>
  );
}

export function NetworkNodeIcon({ size = 18, opacity = 0.7, color = "#FF4700" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" style={{ opacity, flexShrink: 0 }}>
      {/* Hexagonal frame */}
      <polygon points="9,1 16,5 16,13 9,17 2,13 2,5" stroke={color} strokeWidth="1" fill="none" />
      {/* Inner diamond */}
      <polygon points="9,5 13,9 9,13 5,9" stroke={color} strokeWidth="0.75" fill="none" />
      {/* Center dot */}
      <circle cx="9" cy="9" r="1.5" fill={color} />
      {/* Radial lines from inner to outer */}
      <line x1="9" y1="7" x2="9" y2="1" stroke={color} strokeWidth="0.5" strokeDasharray="1 1" />
      <line x1="11" y1="9" x2="16" y2="9" stroke={color} strokeWidth="0.5" strokeDasharray="1 1" />
      <line x1="7" y1="9" x2="2" y2="9" stroke={color} strokeWidth="0.5" strokeDasharray="1 1" />
      <line x1="9" y1="11" x2="9" y2="17" stroke={color} strokeWidth="0.5" strokeDasharray="1 1" />
    </svg>
  );
}

export function MiningLaserIcon({ size = 18, opacity = 0.7, color = "#FF4700" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" style={{ opacity, flexShrink: 0 }}>
      {/* Barrel */}
      <rect x="7" y="1" width="4" height="7" stroke={color} strokeWidth="1" fill="none" />
      {/* Mounting base */}
      <rect x="5" y="8" width="8" height="4" stroke={color} strokeWidth="1" fill="none" />
      {/* Laser beam */}
      <line x1="9" y1="8" x2="9" y2="1" stroke={color} strokeWidth="0.5" strokeDasharray="1.5 1" opacity={0.5} />
      {/* Emitter tip */}
      <rect x="8" y="0" width="2" height="1.5" fill={color} />
      {/* Pivot */}
      <circle cx="9" cy="12" r="1.5" stroke={color} strokeWidth="1" fill="none" />
      <line x1="9" y1="12" x2="9" y2="17" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

/** Convenience map by structure kind */
export function StructureKindIcon({ kind, size = 16, opacity = 0.65 }: { kind: string; size?: number; opacity?: number }) {
  const props = { size, opacity };
  switch (kind) {
    case "Turret":      return <TurretIcon {...props} />;
    case "Gate":        return <GateIcon {...props} />;
    case "StorageUnit": return <SSUIcon {...props} />;
    case "Assembly":    return <AssemblyIcon {...props} />;
    case "NetworkNode": return <NetworkNodeIcon {...props} />;
    default:            return null;
  }
}
