#!/bin/bash
# pull_priority_statics.sh — fetch the priority static files for a cycle
# datamine, plus localization pickles, from the raw-gtr Windows PC over
# SFTP. Reads `resfileindex.txt` to resolve each res-path to its bucket+hash
# under `ccp/EVE Frontier/<cycle>/ResFiles/`.
#
# Usage:
#   ./pull_priority_statics.sh <cycle> <local-dest-dir>
#
# Example:
#   ./pull_priority_statics.sh sanctuary frontier/datamine/sanctuary/raw
#
# Required: env RAWGTR_PASS or sshpass with -p flag.
#
# The cycle name is used both as the remote subdir under "ccp/EVE Frontier/"
# AND as the key for which local resfileindex to read. Convention:
#   frontier/datamine/<cycle>/resfileindex.txt   (must already exist;
#                                                  pull this first separately)

set -euo pipefail

if [ $# -ne 2 ]; then
  echo "usage: $0 <cycle-name> <local-dest-dir>"
  exit 1
fi

CYCLE="$1"
DEST="$2"

INDEX="frontier/datamine/${CYCLE}/resfileindex.txt"
if [ ! -f "$INDEX" ]; then
  echo "FATAL: $INDEX not found. Pull the resfileindex first:"
  echo "  sshpass -p 'agentraw' sftp -o StrictHostKeyChecking=no agent-raw@raw-gtr <<<'get ccp/EVE Frontier/${CYCLE}/resfileindex.txt ${INDEX}'"
  exit 1
fi

mkdir -p "$DEST"

# Priority static file paths. Add/remove as the cycle's structure evolves.
PRIORITY_PATHS=(
  "res:/staticdata/items.static"
  "res:/staticdata/typenames.static"
  "res:/staticdata/blueprints.static"
  "res:/staticdata/solarsystems.static"
  "res:/staticdata/constellations.static"
  "res:/staticdata/regions.static"
  "res:/staticdata/eventtypes.static"
  "res:/staticdata/triggertypes.static"
  "res:/staticdata/factions.static"
  "res:/staticdata/dialogs.static"
  "res:/staticdata/wrecks.static"
  "res:/staticdata/skilltags.static"
  "res:/staticdata/industry_activities.static"
  "res:/staticdata/industry_activity_modifier_sources.static"
  "res:/staticdata/industry_assembly_lines.static"
  "res:/staticdata/industry_installation_types.static"
  "res:/staticdata/module_attributes.static"
  "res:/staticdata/munition_stats.static"
  "res:/localization/localization_fsd_en-us.pickle"
  "res:/localization/localization_fsd_main.pickle"
)

# Resolve each path → resfileindex entry → bucket+full-hash, then queue an
# SFTP `get` for each in a single batch.
BATCH_SCRIPT=$(mktemp /tmp/sftp-batch.XXXX)
trap 'rm -f "$BATCH_SCRIPT"' EXIT

QUEUED=0
SKIPPED=0
for path in "${PRIORITY_PATHS[@]}"; do
  # resfileindex line format:
  #   res:/<path>,<bucket-hash>_<full-hash>,<full-hash>,<size>,<compressed-size>
  # The bucket-hash is the first 2 chars of full-hash; the on-disk path is
  # ResFiles/<2-chars>/<full-hash>.
  line=$(grep -F "${path}," "$INDEX" || true)
  if [ -z "$line" ]; then
    echo "  skip: not in index → $path"
    SKIPPED=$((SKIPPED+1))
    continue
  fi
  # parse: cols 1..3 are path, bucket_fullhash, fullhash
  full_hash=$(echo "$line" | awk -F',' '{print $3}')
  bucket=$(echo "$line" | awk -F',' '{print $2}' | awk -F'_' '{print $1}')
  if [ -z "$full_hash" ] || [ -z "$bucket" ]; then
    echo "  skip: malformed index entry → $path"
    SKIPPED=$((SKIPPED+1))
    continue
  fi
  remote="ccp/EVE Frontier/${CYCLE}/ResFiles/${bucket}/${full_hash}"
  # Use the basename of the res-path as the local filename so the result
  # is human-readable: items.static, not 3e3db...
  local_name=$(basename "${path}")
  local_path="${DEST}/${local_name}"
  echo "get \"${remote}\" \"${local_path}\"" >> "$BATCH_SCRIPT"
  QUEUED=$((QUEUED+1))
done

echo ""
echo "Queued ${QUEUED} fetches (skipped ${SKIPPED} not-in-index entries)."
echo "Running batched SFTP transfer …"
echo ""

PASS="${RAWGTR_PASS:-agentraw}"
sshpass -p "$PASS" sftp -o StrictHostKeyChecking=no -b "$BATCH_SCRIPT" agent-raw@raw-gtr

echo ""
echo "Pulled files to: ${DEST}/"
ls -la "$DEST" | head -25
