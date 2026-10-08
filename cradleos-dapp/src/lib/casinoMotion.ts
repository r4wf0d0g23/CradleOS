/** RAF timestamps can precede an effect's performance.now() in the same frame. */
export function casinoMotionProgress(
  now: number,
  start: number,
  duration: number,
) {
  return Math.max(0, Math.min(1, (now - start) / duration));
}
