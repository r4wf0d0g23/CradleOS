#!/usr/bin/env python3
"""
Minimal decoder for CCP-style .fsdbinary files with an indexed record layout.

This decoder is intentionally schema-agnostic:
- it parses the outer container/header
- extracts indexed records
- splits record qwords into high/low 32-bit components
- detects per-record section headers
- emits JSON that is practical for reverse engineering and downstream tooling

Tested against industry_blueprints.fsdbinary.
"""

from __future__ import annotations

import argparse
import json
import struct
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any


@dataclass
class PackedQword:
    raw: int
    hi: int
    lo: int

    @classmethod
    def from_int(cls, value: int) -> "PackedQword":
        return cls(raw=value, hi=(value >> 32) & 0xFFFFFFFF, lo=value & 0xFFFFFFFF)

    def to_json(self) -> dict[str, int]:
        return {"raw": self.raw, "hi": self.hi, "lo": self.lo}


@dataclass
class SectionHeader:
    constant_a: int
    constant_b: int
    start_rel: int
    end_rel: int
    section_key: int
    section_value: int
    section_id: int

    def to_json(self) -> dict[str, int]:
        return asdict(self)


@dataclass
class Record:
    record_index: int
    record_offset: int
    record_length: int
    section_count: int
    record_id: int
    headers: list[SectionHeader]
    payload: list[PackedQword]
    payload_pairs: list[dict[str, int]]
    payload_literals: list[int]

    def to_json(self) -> dict[str, Any]:
        return {
            "record_index": self.record_index,
            "record_offset": self.record_offset,
            "record_length": self.record_length,
            "section_count": self.section_count,
            "record_id": self.record_id,
            "headers": [h.to_json() for h in self.headers],
            "payload": [p.to_json() for p in self.payload],
            "payload_pairs": self.payload_pairs,
            "payload_literals": self.payload_literals,
        }


class FSDBinaryDecoder:
    def __init__(self, data: bytes):
        self.data = data
        self.file_size = len(data)

    def u64(self, off: int) -> int:
        return struct.unpack_from("<Q", self.data, off)[0]

    def parse(self) -> dict[str, Any]:
        if self.file_size < 56:
            raise ValueError("File is too small to be a supported fsdbinary container")

        # Observed outer layout for this family of files:
        # 0x00..0x17 : 24-byte opaque hash / signature block
        # 0x18       : container size / end marker
        # 0x20       : base offset (usually 24)
        # 0x28       : opaque schema/container value
        # 0x30       : record count
        opaque_prefix = self.data[:24].hex()
        container_size = self.u64(24)
        base_offset = self.u64(32)
        schema_value = self.u64(40)
        record_count = self.u64(48)

        if base_offset <= 0 or record_count <= 0:
            raise ValueError("Header values do not match expected indexed fsdbinary layout")

        index_start = 56
        index_end = index_start + (record_count * 8)
        if index_end > self.file_size:
            raise ValueError("Index extends past end of file")

        rel_offsets = [self.u64(index_start + i * 8) for i in range(record_count)]
        abs_offsets = [base_offset + off for off in rel_offsets]

        # The final 8 bytes appear to be a trailing sentinel / footer marker for this file family.
        # The last record is cut at file_size - 8 if that leaves a sane record length.
        logical_end = self.file_size - 8 if self.file_size - 8 > abs_offsets[-1] else self.file_size

        records: list[Record] = []
        for i, start in enumerate(abs_offsets):
            end = abs_offsets[i + 1] if i + 1 < len(abs_offsets) else logical_end
            if end < start:
                raise ValueError(f"Record {i} has negative length")
            blob = self.data[start:end]
            records.append(self._parse_record(i, start, blob))

        return {
            "header": {
                "opaque_prefix_hex": opaque_prefix,
                "container_size": container_size,
                "base_offset": base_offset,
                "schema_value": schema_value,
                "record_count": record_count,
                "index_start": index_start,
                "index_end": index_end,
                "logical_end": logical_end,
                "file_size": self.file_size,
            },
            "record_offsets": abs_offsets,
            "records": [r.to_json() for r in records],
        }

    def _parse_record(self, record_index: int, abs_offset: int, blob: bytes) -> Record:
        if len(blob) % 8 != 0:
            raise ValueError(f"Record {record_index} length {len(blob)} is not qword-aligned")
        qwords = [struct.unpack_from("<Q", blob, off)[0] for off in range(0, len(blob), 8)]
        if len(qwords) < 2:
            raise ValueError(f"Record {record_index} too short")

        section_count = qwords[0]
        record_id = qwords[1]

        # Observed per-section header size for this file family: 7 qwords per section.
        header_qwords = 2 + (section_count * 7)
        if header_qwords > len(qwords):
            # Fall back to raw dump instead of crashing on unknown variant.
            section_count = 0
            headers = []
            payload_qwords = qwords[2:]
        else:
            headers = []
            cursor = 2
            for _ in range(section_count):
                group = qwords[cursor:cursor + 7]
                key_q = PackedQword.from_int(group[4])
                val_q = PackedQword.from_int(group[5])
                headers.append(
                    SectionHeader(
                        constant_a=group[0],
                        constant_b=group[1],
                        start_rel=group[2],
                        end_rel=group[3],
                        section_key=key_q.hi,
                        section_value=val_q.lo,
                        section_id=group[6],
                    )
                )
                cursor += 7
            payload_qwords = qwords[cursor:]

        payload = [PackedQword.from_int(v) for v in payload_qwords]
        payload_pairs = [
            {"key": p.hi, "value": p.lo}
            for p in payload
            if p.hi != 0
        ]
        payload_literals = [p.lo for p in payload if p.hi == 0]

        return Record(
            record_index=record_index,
            record_offset=abs_offset,
            record_length=len(blob),
            section_count=section_count,
            record_id=record_id,
            headers=headers,
            payload=payload,
            payload_pairs=payload_pairs,
            payload_literals=payload_literals,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Decode indexed .fsdbinary files into JSON")
    parser.add_argument("input", type=Path, help="Path to .fsdbinary file")
    parser.add_argument("-o", "--output", type=Path, help="Write decoded JSON here")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON")
    parser.add_argument("--summary", action="store_true", help="Print a compact human summary instead of full JSON")
    args = parser.parse_args()

    data = args.input.read_bytes()
    decoded = FSDBinaryDecoder(data).parse()

    if args.summary:
        header = decoded["header"]
        print(f"file_size={header['file_size']}")
        print(f"record_count={header['record_count']}")
        print(f"schema_value={header['schema_value']}")
        print(f"base_offset={header['base_offset']}")
        for rec in decoded["records"][:10]:
            print(
                f"record[{rec['record_index']}]: id={rec['record_id']} "
                f"sections={rec['section_count']} len={rec['record_length']}"
            )
        return

    text = json.dumps(decoded, indent=2 if args.pretty else None)
    if args.output:
        args.output.write_text(text, encoding="utf-8")
    else:
        print(text)


if __name__ == "__main__":
    main()
