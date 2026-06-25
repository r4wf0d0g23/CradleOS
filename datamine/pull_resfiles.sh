#!/bin/bash
# pull_resfiles.sh — fetch a list of res-paths from agent-raw@100.73.243.84
# (Raw's Windows PC) using the local resfileindex to resolve each res-path
# to its ResFiles/<bucket>/<full-hash> location, then batched SFTP get.
#
# Usage:
#   ./pull_resfiles.sh <index.txt> <dest-dir> <paths-file>
#
# paths-file: one res-path per line, e.g.:
#   res:/staticdata/items.static
#   res:/staticdata/blueprints.static
#
# Resolves each via the resfileindex, queues into one SFTP batch, names the
# local file by the basename of the res-path.

set -euo pipefail

if [ $# -ne 3 ]; then
  echo "usage: $0 <resfileindex.txt> <local-dest-dir> <paths-file>"
  exit 1
fi

INDEX="$1"
DEST="$2"
PATHS_FILE="$3"

if [ ! -f "$INDEX" ]; then
  echo "FATAL: index not found: $INDEX" >&2; exit 1
fi
if [ ! -f "$PATHS_FILE" ]; then
  echo "FATAL: paths file not found: $PATHS_FILE" >&2; exit 1
fi

mkdir -p "$DEST"

BATCH=$(mktemp /tmp/sftp-batch.XXXX)
trap 'rm -f "$BATCH"' EXIT

QUEUED=0
SKIPPED=0
while IFS= read -r path; do
  # Skip blank lines and comments
  path=$(echo "$path" | sed 's/[[:space:]]*$//')
  if [ -z "$path" ] || [[ "$path" == \#* ]]; then continue; fi

  # Look up this exact res-path in the index. The index uses exact paths so
  # grep -F + the comma terminator is safe.
  line=$(grep -F "${path}," "$INDEX" || true)
  if [ -z "$line" ]; then
    echo "  skip (not in index): $path" >&2
    SKIPPED=$((SKIPPED+1))
    continue
  fi

  # The second column already encodes the on-disk path inside ResFiles
  # as `<bucket>/<bucket-hash>_<full-hash>` (e.g. `ae/ae5a425...`). Use
  # it verbatim.
  rel=$(echo "$line" | awk -F',' '{print $2}')
  if [ -z "$rel" ]; then
    echo "  skip (malformed): $path" >&2
    SKIPPED=$((SKIPPED+1))
    continue
  fi

  remote="/C:/CCP/EVE Frontier/ResFiles/${rel}"
  local_name=$(basename "${path}")
  local_path="${DEST}/${local_name}"
  echo "get \"${remote}\" \"${local_path}\"" >> "$BATCH"
  QUEUED=$((QUEUED+1))
done < "$PATHS_FILE"

echo "Queued ${QUEUED} fetches (skipped ${SKIPPED})." >&2
if [ "$QUEUED" -eq 0 ]; then
  echo "Nothing to fetch." >&2; exit 0
fi

sftp -b "$BATCH" agent-raw@100.73.243.84

echo "" >&2
echo "Done. Files in: ${DEST}/" >&2
ls -lhS "$DEST" | head -20 >&2
