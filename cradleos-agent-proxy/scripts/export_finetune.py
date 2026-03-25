#!/usr/bin/env python3
"""
Export training data from JSONL logs to fine-tuning format.

Usage:
  cat training_logs/*.jsonl | python3 scripts/export_finetune.py > dataset.jsonl

Output format: OpenAI fine-tuning JSONL (messages array)
Filter: only includes samples without quality: null (i.e., feedback-labeled samples)
         or all samples if --all flag is passed.
"""
import sys, json, argparse

parser = argparse.ArgumentParser()
parser.add_argument("--all", action="store_true", help="Include unlabeled samples")
parser.add_argument("--min-quality", type=float, default=0.7, help="Min quality score 0-1")
args = parser.parse_args()

count = 0
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        sample = json.loads(line)
    except json.JSONDecodeError:
        continue
    if sample.get("feedback"):
        continue  # skip feedback records
    quality = sample.get("quality")
    if not args.all and (quality is None or quality < args.min_quality):
        continue
    messages = sample.get("messages", [])
    if not messages:
        continue
    response = sample.get("response", "")
    if not response:
        continue
    # Format for OpenAI fine-tuning
    ft_sample = {
        "messages": messages + [{"role": "assistant", "content": response}]
    }
    print(json.dumps(ft_sample))
    count += 1

print(f"# Exported {count} samples", file=sys.stderr)
