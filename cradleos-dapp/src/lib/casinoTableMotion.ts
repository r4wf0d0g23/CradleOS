import type { Round, Choice } from "./casinoPractice";
import type { Session } from "./casinoSessions";
import type { TableAction } from "./casinoBlackjackTable";
export type TableRun = {
  id: number;
  started: number;
  duration: number;
  previous?: Session;
  action?: TableAction;
  choice?: Choice;
};
export const STILL_RUN: TableRun = { id: 0, started: 0, duration: 1 };
export const clamp = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export function tableDuration(round: Round | null) {
  const game = round?.game;
  if (game === "andar_bahar")
    return Math.max(1600, (round!.values.length - 1) * 210 + 650);
  if (game === "roulette") return 3300;
  if (["wheel", "risk_wheel", "money_wheel"].includes(game ?? "")) return 2800;
  if (game === "coinflip") return 1800;
  if (["war", "dragon_tiger", "red_dog"].includes(game ?? "")) return 2000;
  if (["baccarat", "three_card_poker"].includes(game ?? "")) return 2900;
  if (game === "scratch_cards") return 300;
  if (game === "keno") return 3200;
  if (["crash", "limbo", "ore_refine"].includes(game ?? "")) return 2700;
  return 2400;
}
export function wheelAngle(t: number, index: number, n: number) {
  return (1440 + ((360 - (index * 360) / n) % 360)) * ease(t);
}
export function rouletteBall(t: number, _angle: number) {
  const p = clamp(t),
    drop = clamp((p - 0.68) / 0.24),
    theta = 1080 * (1 - ease(p));
  // Counter-rotating flight converges to the selected top pocket; no endpoint reassignment.
  const a = ((-90 + theta) * Math.PI) / 180,
    r =
      142 -
      15 * ease(drop) +
      (p > 0.82 && p < 1
        ? (Math.sin((p - 0.82) * Math.PI * 28) * 3 * (1 - p)) / 0.18
        : 0);
  return { x: 160 + Math.cos(a) * r, y: 160 + Math.sin(a) * r };
}
export function coinPose(t: number, face: number) {
  const p = clamp(t);
  return {
    angle: ease(p) * (1800 + face * 180),
    lift: Math.sin(Math.PI * p) * 70,
    tilt: Math.sin(p * Math.PI * 2) * 14 * (1 - p),
  };
}
export type DealEvent = {
  row: number;
  index: number;
  at: number;
  kind: "deal" | "flip";
};
export function blackjackPlan(next: Session, previous?: Session) {
  const table = next.table ?? next.pack?.table,
    old = previous?.table;
  if (!table) return { events: [] as DealEvent[], duration: 650 };
  const events: DealEvent[] = [];
  let tick = 100;
  if (!old) {
    for (let c = 0; c < 2; c++) {
      for (let h = 0; h < table.hands.length; h++) {
        events.push({ row: h, index: c, at: tick, kind: "deal" });
        tick += 170;
      }
      events.push({ row: -1, index: c, at: tick, kind: "deal" });
      tick += 170;
    }
  } else {
    table.hands.forEach((h, row) => {
      const previousHands = old.hands.filter((x) => x.seat === h.seat);
      const ordinal = table.hands
        .slice(0, row)
        .filter((x) => x.seat === h.seat).length;
      const prior = previousHands[ordinal];
      h.cards.forEach((card, index) => {
        if (prior?.cards[index] !== card) {
          events.push({ row, index, at: tick, kind: "deal" });
          tick += 210;
        }
      });
    });
  }
  if (table.complete && (!old || !old.complete)) {
    events.push({ row: -1, index: 1, at: tick + 130, kind: "flip" });
    tick += 380;
    for (let c = 2; c < table.dealer.length; c++) {
      events.push({ row: -1, index: c, at: tick, kind: "deal" });
      tick += 310;
    }
  }
  return { events, duration: Math.max(650, tick + 440) };
}
