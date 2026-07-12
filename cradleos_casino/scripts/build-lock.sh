#!/usr/bin/env bash
# CradleOS casino-roadmap-builder concurrency guard.
#
# The builder cron fires hourly. Each run takes ~30 min but occasionally longer
# (Move publish + SSH to DGX1 + dual deploy). Overlapping runs would collide on
# the single UpgradeCap (serial on-chain), the gh-pages git push, and the shared
# source tree (constants.ts written by two sessions). This lock makes an
# already-running build cause the next fire to NO-OP cleanly.
#
# Usage:
#   scripts/build-lock.sh acquire   -> exit 0 if lock taken (proceed), exit 10 if busy (skip run)
#   scripts/build-lock.sh release   -> always exit 0 (idempotent)
#   scripts/build-lock.sh status    -> print lock state
#
# Staleness: a lock older than STALE_MIN minutes is considered abandoned
# (crashed run / gateway SIGTERM) and is stolen so builds never wedge forever.

set -uo pipefail

LOCK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_FILE="$LOCK_DIR/.build-lock"
STALE_MIN=75

now() { date +%s; }

acquire() {
  if [[ -f "$LOCK_FILE" ]]; then
    local ts age pid
    ts=$(sed -n '1p' "$LOCK_FILE" 2>/dev/null || echo 0)
    pid=$(sed -n '2p' "$LOCK_FILE" 2>/dev/null || echo "?")
    age=$(( ( $(now) - ts ) / 60 ))
    if (( age < STALE_MIN )); then
      echo "BUSY: build lock held (age ${age}m, pid ${pid}); skipping this run." >&2
      return 10
    fi
    echo "STALE: lock age ${age}m > ${STALE_MIN}m — stealing (previous run likely crashed)." >&2
  fi
  printf '%s\n%s\n%s\n' "$(now)" "$$" "$(date -Is)" > "$LOCK_FILE"
  echo "ACQUIRED: build lock taken at $(date -Is)." >&2
  return 0
}

release() {
  rm -f "$LOCK_FILE"
  echo "RELEASED: build lock cleared." >&2
  return 0
}

status() {
  if [[ -f "$LOCK_FILE" ]]; then
    local ts age; ts=$(sed -n '1p' "$LOCK_FILE" 2>/dev/null || echo 0)
    age=$(( ( $(now) - ts ) / 60 ))
    echo "LOCKED (age ${age}m): $(cat "$LOCK_FILE" | tr '\n' ' ')"
  else
    echo "UNLOCKED"
  fi
  return 0
}

case "${1:-status}" in
  acquire) acquire ;;
  release) release ;;
  status)  status ;;
  *) echo "usage: $0 {acquire|release|status}" >&2; exit 2 ;;
esac
