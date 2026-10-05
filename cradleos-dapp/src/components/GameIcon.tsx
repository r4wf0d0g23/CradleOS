import { useState } from "react";
import { iconAssetUrl, useGameIcons } from "../lib/gameIcons";
import "./GameIcon.css";

// Decorative alongside a visible name. A missing image never hides item text.
function Image({ src, size }: { src: string | null; size: number }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? <img className="game-icon" src={src} width={size} height={size} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} /> :
    <span className="game-icon game-icon-missing" style={{ width: size, height: size }} aria-hidden="true" title="No verified icon available">◇</span>;
}
export function GameIcon({ asset, size = 32 }: { asset: string | null | undefined; size?: number }) {
  const src = iconAssetUrl(asset);
  return <Image key={src ?? "missing"} src={src} size={size} />;
}
export function ItemIcon({ typeId, size = 32 }: { typeId: number | undefined; size?: number }) {
  const { data } = useGameIcons();
  const row = typeId === undefined ? undefined : data?.types[typeId];
  return <GameIcon asset={row?.asset} size={size} />;
}
export function ClientUIIcon({ name, size = 20 }: { name: string; size?: number }) {
  const { data } = useGameIcons();
  return <GameIcon asset={data?.ui[name]?.asset} size={size} />;
}
