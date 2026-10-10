import { useId } from "react";
import { clamp, ease } from "../lib/casinoTableMotion";
const LABELS = ["SLAG", "PARTIAL YIELD", "REFINED YIELD", "BONUS YIELD"];
export function CasinoRefinery({
  t,
  has,
  yieldKind,
}: {
  t: number;
  has: boolean;
  yieldKind: number;
}) {
  const id = useId().replace(/:/g, ""),
    done = has && t === 1,
    feed = has ? ease(clamp(t / 0.35)) : 0,
    heat = has ? Math.sin(clamp((t - 0.2) / 0.65) * Math.PI) : 0,
    output = has ? ease(clamp((t - 0.76) / 0.24)) : 0;
  return (
    <div
      className={`refinery-workshop ${done ? `yield-${yieldKind}` : ""}`}
      data-progress={t}
    >
      <svg
        viewBox="0 0 480 320"
        role="img"
        aria-label={
          done ? LABELS[yieldKind] : has ? "Refining" : "Refinery ready"
        }
      >
        <defs>
          <linearGradient id={`${id}-steel`} x2=".2" y2="1">
            <stop stopColor="#a5afa3" />
            <stop offset=".25" stopColor="#475c5b" />
            <stop offset=".8" stopColor="#25383e" />
            <stop offset="1" stopColor="#111e25" />
          </linearGradient>
          <radialGradient id={`${id}-heat`}>
            <stop stopColor="#fff3ad" />
            <stop offset=".4" stopColor="#f99044" />
            <stop offset="1" stopColor="#e3410c" stopOpacity="0" />
          </radialGradient>
          <clipPath id={`${id}-furnace`}>
            <rect x="178" y="77" width="124" height="136" rx="18" />
          </clipPath>
        </defs>
        <ellipse cx="240" cy="289" rx="220" ry="18" fill="#000" opacity=".45" />
        <path
          d="M31 241h418v34H31ZM40 275h26v14H40Zm374 0h26v14h-26Z"
          fill="#23353c"
          stroke="#7a8b7f"
        />
        <path
          d="M15 200h140v39H15ZM325 213h140v28H325Z"
          fill={`url(#${id}-steel)`}
          stroke="#819585"
          strokeWidth="2"
        />
        <path d="M17 204h136M328 217h132" stroke="#c0c3a5" strokeWidth="2" />
        {[30, 53, 76, 99, 122, 340, 365, 390, 415, 440].map((x, i) => (
          <g
            key={x}
            transform={`translate(${x} ${x < 150 ? 224 : 229}) rotate(${has ? (x < 150 ? feed : output) * 720 * (i % 2 ? 1 : -1) : 0})`}
          >
            <circle r="9" fill="#151f26" stroke="#94a08c" strokeWidth="2" />
            <path d="M-6 0H6M0-6V6" stroke="#66766d" />
          </g>
        ))}
        <g
          transform={`translate(${feed * 143} 0)`}
          opacity={1 - clamp((feed - 0.77) / 0.23)}
        >
          <path
            d="M30 198 24 174 39 153 65 160 76 190 57 202Z"
            fill="#849991"
            stroke="#b7c2ab"
            strokeWidth="1.5"
          />
          <path
            d="M39 153 46 178 24 174M46 178 65 160M46 178 57 202 76 190Z"
            fill="#435e62"
            stroke="#92a298"
          />
        </g>
        <path
          d="M163 242V62l18-19h119l18 19v180Z"
          fill={`url(#${id}-steel)`}
          stroke="#95a28d"
          strokeWidth="3"
        />
        <path
          d="M193 43V24h92v19"
          fill="#283d43"
          stroke="#82977f"
          strokeWidth="3"
        />
        <path
          d="M200 26h12v17M220 26h12v17M240 26h12v17M260 26h12v17"
          stroke="#0f2028"
          strokeWidth="5"
        />
        <rect
          x="174"
          y="72"
          width="132"
          height="147"
          rx="20"
          fill="#08191f"
          stroke="#617874"
          strokeWidth="5"
        />
        <g clipPath={`url(#${id}-furnace)`}>
          <circle
            cx="240"
            cy="145"
            r="90"
            fill={`url(#${id}-heat)`}
            opacity={heat * 0.85}
          />
          <g
            className="refinery-blades"
            style={{
              transform: `rotate(${has ? ease(t) * 720 : 0}deg)`,
              transformOrigin: "240px 146px",
            }}
          >
            {Array.from({ length: 8 }, (_, i) => (
              <path
                key={i}
                d="M231 82h18l6 27-15 17-15-17Z"
                transform={`rotate(${i * 45} 240 146)`}
                fill="#a2afa4"
                stroke="#20393f"
                strokeWidth="2"
              />
            ))}
          </g>
          <circle
            cx="240"
            cy="146"
            r="26"
            fill="#20363a"
            stroke="#a5ae91"
            strokeWidth="4"
          />
          <circle
            cx="240"
            cy="146"
            r="16"
            fill={`url(#${id}-heat)`}
            opacity={heat}
          />
          {Array.from({ length: 14 }, (_, i) => {
            const a = ((i * 71 + t * 90) * Math.PI) / 180,
              r = 30 + ((i * 17 + t * 110) % 48);
            return (
              <path
                key={i}
                d={`M${240 + Math.cos(a) * r} ${146 + Math.sin(a) * r}l${Math.cos(a) * 5} ${Math.sin(a) * 5}`}
                stroke="#ffd39b"
                strokeWidth={i % 3 === 0 ? 1.8 : 1}
                opacity={heat * (0.3 + (i % 4) * 0.15)}
              />
            );
          })}
          <path
            d="M183 81 214 77 276 211 245 215Z"
            fill="#b9e0dc"
            opacity=".055"
          />
        </g>
        {[185, 295].flatMap((x) =>
          [60, 231].map((y) => (
            <g key={`${x}${y}`}>
              <circle cx={x} cy={y} r="4" fill="#acb59c" />
              <path d={`M${x - 2} ${y}h4`} stroke="#182c32" />
            </g>
          )),
        )}
        <rect x="214" y="229" width="52" height="6" rx="2" fill="#11282e" />
        <rect
          x="215"
          y="230"
          width={has ? 50 * t : 0}
          height="4"
          rx="1"
          fill="#ddab6a"
        />
        <g transform={`translate(${output * 88} 0)`} opacity={output}>
          <path d="M318 213v-28h34v28" fill="#182d32" stroke="#778d7e" />
          {done ? (
            yieldKind === 0 ? (
              <path
                d="m316 209 7-17 13 1 11 9-2 10Z"
                fill="#4c5050"
                stroke="#828677"
              />
            ) : (
              <g>
                {Array.from({ length: yieldKind }, (_, i) => (
                  <g key={i} transform={`translate(${i * 7} ${-i * 6})`}>
                    <path
                      d="m315 202 6-10h22l4 10-5 9h-23Z"
                      fill={yieldKind === 3 ? "#bd9d56" : "#829b91"}
                      stroke="#d1cdaa"
                    />
                    <path
                      d="m315 202 27-1 5 1M342 201v10"
                      fill="none"
                      stroke="#314b50"
                    />
                  </g>
                ))}
              </g>
            )
          ) : (
            <path d="M317 185h35v28h-35Z" fill="#50665f" stroke="#8c9a81" />
          )}
        </g>
        <path
          d="M330 245v-33M441 245v-33M326 245h120"
          stroke="#789384"
          strokeWidth="4"
        />
        <text
          x="240"
          y="311"
          textAnchor="middle"
          fill="#d4d4b5"
          fontSize="11"
          letterSpacing="3"
        >
          {done
            ? LABELS[yieldKind]
            : !has
              ? "READY"
              : t < 0.3
                ? "FEED"
                : t < 0.76
                  ? "REFINE"
                  : "EXTRACT"}
        </text>
      </svg>
    </div>
  );
}
