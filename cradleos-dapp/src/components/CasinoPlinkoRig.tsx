import { memo } from "react";

/** Recessed backing hardware, not additional collision surfaces. */
export const PlinkoRigHousing = memo(function PlinkoRigHousing({
  id,
  salvage,
  reprocess,
}: {
  id: string;
  salvage: string | null;
  reprocess: string | null;
}) {
  return (
    <g className="plinko-rig-housing" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-housing`} x2=".8" y2="1">
          <stop stopColor="#5c6057" />
          <stop offset=".12" stopColor="#272b28" />
          <stop offset=".6" stopColor="#141916" />
          <stop offset="1" stopColor="#343932" />
        </linearGradient>
        <linearGradient id={`${id}-steel`} x2=".8" y2="1">
          <stop stopColor="#bec0aa" />
          <stop offset=".28" stopColor="#656b60" />
          <stop offset=".55" stopColor="#282f2b" />
          <stop offset="1" stopColor="#535b4e" />
        </linearGradient>
        <linearGradient id={`${id}-ceramic`} x2=".3" y2="1">
          <stop stopColor="#202724" />
          <stop offset="1" stopColor="#0c1211" />
        </linearGradient>
        <linearGradient id={`${id}-well`} x2="0" y2="1">
          <stop stopColor="#030606" />
          <stop offset=".7" stopColor="#111815" />
          <stop offset="1" stopColor="#62634b" />
        </linearGradient>
        <pattern
          id={`${id}-hazard`}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-35)"
        >
          <rect width="8" height="8" fill="#262c25" />
          <rect width="3" height="8" fill="#c37738" />
        </pattern>
        <pattern
          id={`${id}-grain`}
          width="39"
          height="31"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M3 4h4m18 14h2m-10 8h5"
            stroke="#b8b8a4"
            strokeWidth=".3"
            opacity=".055"
          />
        </pattern>
      </defs>
      <path
        d="M4-35H283l17 17v268l-12 19H8l-14-15V-23Z"
        fill="#060a09"
        stroke="#030605"
        strokeWidth="4"
      />
      <path
        d="M4-35H283l17 17v268l-12 19H8l-14-15V-23Z"
        fill={`url(#${id}-housing)`}
        stroke="#75796a"
        strokeWidth=".8"
      />
      <path
        d="M9-29H279l14 15v261l-10 15H13L1 251V-18Z"
        fill="none"
        stroke="#0b100e"
        strokeWidth="2"
      />
      <path
        d="M17-3H283V209l-11 16H28l-11-16Z"
        fill={`url(#${id}-ceramic)`}
        stroke="#676e5e"
        strokeWidth=".65"
      />
      <path
        d="M22 2H278V207l-10 13H32l-10-13Z"
        fill="#0c1412"
        stroke="#060b09"
        strokeWidth="2"
      />
      <path d="M22 2H278V207l-10 13H32l-10-13Z" fill={`url(#${id}-grain)`} />
      <path
        d="M30 191V17H127M173 17h97v174"
        fill="none"
        stroke="#52604a"
        strokeWidth=".5"
        opacity=".22"
      />
      <path
        d="M28-25H111l7 7-7 7H28Z"
        fill="#151b17"
        stroke="#666f5b"
        strokeWidth=".5"
      />
      {salvage && (
        <image
          className="plinko-client-mark"
          href={salvage}
          x="34"
          y="-22"
          width="12"
          height="12"
          opacity=".68"
        />
      )}
      <text x="53" y="-13" fill="#c4c6ac" fontSize="7" letterSpacing="1.3">
        CRDL / 12
      </text>
      <path
        d="M189-25h82v14h-82l-7-7Z"
        fill="#151b17"
        stroke="#666f5b"
        strokeWidth=".5"
      />
      {reprocess && (
        <image
          className="plinko-client-mark"
          href={reprocess}
          x="250"
          y="-22"
          width="12"
          height="12"
          opacity=".68"
        />
      )}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path
          key={i}
          d={`M${200 + i * 6} -20v5`}
          stroke={i === 0 ? "#c77843" : "#69745d"}
          strokeWidth={i % 2 ? 1 : 2}
          opacity=".5"
        />
      ))}
      {[10, 290].flatMap((x) =>
        [-19, 81, 180, 248].map((y) => (
          <g key={`${x},${y}`}>
            <circle
              cx={x}
              cy={y}
              r="2.2"
              fill="#030806"
              stroke="#727769"
              strokeWidth=".5"
            />
            <path d={`M${x - 1} ${y}h2`} stroke="#8d9380" strokeWidth=".65" />
          </g>
        )),
      )}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <g key={i}>
          <path
            d={`M6 ${29 + i * 5}h7m274 0h7`}
            stroke="#060b09"
            strokeWidth="2"
          />
          <path
            d={`M6 ${30 + i * 5}h7m274 0h7`}
            stroke="#666c5c"
            strokeWidth=".5"
            opacity=".45"
          />
        </g>
      ))}
      <path
        d="M4 209h10v26H4Zm282 0h10v26h-10Z"
        fill={`url(#${id}-hazard)`}
        opacity=".8"
      />
      <path
        d="M24-31h33m184 0h17M-2 116v18m299 28v12M25 265h18m211 0h14"
        fill="none"
        stroke="#c4c1a7"
        strokeWidth=".65"
        opacity=".4"
      />
      <path
        d="M32 254h10m-8 2h5m211-2h16m-12 2h6"
        fill="none"
        stroke="#9aa38a"
        strokeWidth=".6"
        opacity=".28"
      />
    </g>
  );
});

/** Doors sit above the unchanged y=5 release point. Subsequent loads open in advance. */
export function PlinkoRigFeeder({ id, open }: { id: string; open: number }) {
  return (
    <g className="plinko-feeder" data-open={open} aria-hidden="true">
      <path
        d="M132-30h36l5 8V5l-9 8h-8V-5h-12v18h-8l-9-8v-27Z"
        fill={`url(#${id}-steel)`}
        stroke="#080d0b"
        strokeWidth="1.5"
      />
      <path
        d="M139-27h22v6h-22Z"
        fill="#222b22"
        stroke="#9f9e7f"
        strokeWidth=".5"
      />
      <path d="M144-20h12V8h-12Z" fill="#030806" />
      <path d="M135-17v17m30-17v17" stroke="#090f0a" strokeWidth="3" />
      <path d="M135-17v17m30-17v17" stroke="#99a18b" strokeWidth=".7" />
      <path
        className="plinko-feed-jaw"
        d="M144-13h6V0h-6Z"
        transform={`translate(${-open * 5.5} 0)`}
        fill="#96997d"
        stroke="#222c20"
        strokeWidth=".5"
      />
      <path
        className="plinko-feed-jaw"
        d="M150-13h6V0h-6Z"
        transform={`translate(${open * 5.5} 0)`}
        fill="#96997d"
        stroke="#222c20"
        strokeWidth=".5"
      />
      <path d="M133 6h9m16 0h9" stroke="#d98046" strokeWidth="1.3" />
      <rect
        x="146"
        y="-25"
        width="8"
        height="2"
        rx=".5"
        fill={open > 0.02 ? "#f0a45b" : "#4e5941"}
      />
      <path d="M136-20h3m22 0h3" stroke="#b7b594" strokeWidth=".65" />
    </g>
  );
}
