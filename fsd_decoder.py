#!/usr/bin/env python3
"""
EVE Frontier FSD (Frontier Static Data) Decoder
Reverse-engineered from game client binary format.

File formats:
  .static   - [schema_size:u32][schema:pickle][blob_size:u32][binary_blob]
  .pickle   - raw Python pickle (no prefix)
  .fsdbinary - same as .static (CCP internal name)
  .schema   - YAML (human-readable schema, not parsed here)

Author: Reality Anchor — decoded 2026-03-06
"""

import os, pickle, struct, yaml
from collections import OrderedDict


class FSDDecoder:

    def decode_file(self, path: str):
        """Auto-detect format and decode a file."""
        with open(path, "rb") as f:
            data = f.read()

        ext = os.path.splitext(path)[1].lower()

        if ext == ".pickle":
            return pickle.loads(data)

        if ext in (".static", ".fsdbinary"):
            return self.decode_static(data)

        # Try static format anyway
        try:
            return self.decode_static(data)
        except Exception:
            pass

        # Fall back to pickle
        return pickle.loads(data)

    def decode_static(self, data: bytes, external_schema: dict = None):
        """
        Decode .static / .fsdbinary file bytes.

        Format A (schema embedded):
          [schema_size: u32][schema: pickle][blob_size: u32][blob]
          Detected when: schema_size is plausible AND pickle parses correctly.

        Format B (schema external / schema-less):
          [blob_size: u32][blob]
          blob_size == filesize - 4 is the tell.
          Schema must be passed via external_schema or loaded from companion .schema file.

        Format C (tiny, no schema):
          [count: u32][item0: u32]...
          Used for simple lists like factionsowningsolarsystems.static.
        """
        if len(data) < 8:
            # Tiny: simple count-prefixed uint32 array
            count = struct.unpack_from('<I', data)[0]
            return [struct.unpack_from('<I', data, 4 + i*4)[0]
                    for i in range(count) if 4 + (i+1)*4 <= len(data)]

        first_u32 = struct.unpack_from('<I', data)[0]

        # Detect Format A: first_u32 is a plausible schema size
        schema = None
        blob = None
        if 8 <= first_u32 <= len(data) - 8:
            try:
                schema = pickle.loads(data[4:4+first_u32])
                blob_size = struct.unpack_from('<I', data, 4+first_u32)[0]
                blob = data[4+first_u32+4:4+first_u32+4+blob_size]
            except Exception:
                schema = None
                blob = None

        # Format B: blob_size == filesize - 4
        if schema is None and blob is None:
            blob_size = first_u32
            if blob_size == len(data) - 4:
                blob = data[4:4+blob_size]
                schema = external_schema  # may be None if not provided

        if blob is None:
            # Last resort: treat as uint32 array
            count = first_u32
            return [struct.unpack_from('<I', data, 4 + i*4)[0]
                    for i in range(count) if 4 + (i+1)*4 <= len(data)]

        if schema is None:
            # Raw blob, no schema — return raw bytes
            return {"_raw_blob": len(blob), "_hex_preview": blob[:32].hex()}

        return self.decode_blob(blob, schema)

    def decode_blob(self, blob: bytes, schema: dict):
        """Dispatch blob decoding based on schema type."""
        t = schema.get("type")
        if t == "dict":
            return self.decode_dict_blob(blob, schema)
        elif t == "list":
            return self.decode_list_blob(blob, schema)
        elif t == "object":
            return self.decode_object(blob, 0, schema)
        else:
            raise ValueError(f"Unknown top-level schema type: {t}")

    # ------------------------------------------------------------------
    # DICT
    # ------------------------------------------------------------------
    def decode_dict_blob(self, blob: bytes, schema: dict) -> dict:
        """
        Dict blob layout:
          [records / string data]
          [keyFooter_count: u32]
          [keyFooter_entries: count * 8 bytes]  (each: key i32, offset u32)
          [keyFooter_section_size: u32]   ← LAST 4 bytes

        The last 4 bytes = total size of keyFooter section = 4 + count*8.
        Work backwards: kf_size → kf_start → count → entries.
        """
        if len(blob) < 8:
            return {}

        # Last 4 bytes = keyFooter section size (NOT the count)
        kf_size = struct.unpack_from('<I', blob, len(blob)-4)[0]

        # Sanity: kf_size must be plausible
        if kf_size > len(blob) - 4 or kf_size < 4:
            return {}

        kf_start = len(blob) - 4 - kf_size
        count = struct.unpack_from('<I', blob, kf_start)[0]

        # Verify: 4 + count*8 == kf_size
        if 4 + count * 8 != kf_size:
            return {}

        value_schema = schema["valueTypes"]
        result = {}

        entries_start = kf_start + 4  # skip the count field

        for i in range(count):
            pos = entries_start + i * 8
            key    = struct.unpack_from('<i', blob, pos)[0]
            offset = struct.unpack_from('<I', blob, pos+4)[0]
            try:
                value = self.decode_record(blob, offset, value_schema)
                result[key] = value
            except Exception as e:
                result[key] = f"<decode error: {e}>"

        return result

    # ------------------------------------------------------------------
    # RECORD DISPATCH
    # ------------------------------------------------------------------
    def decode_record(self, blob: bytes, offset: int, schema: dict):
        t = schema.get("type")
        if t == "object":
            return self.decode_object(blob, offset, schema)
        elif t == "string":
            return self.decode_string_at(blob, offset)
        elif t == "resPath":
            return self.decode_string_at(blob, offset)
        elif t == "int":
            return self.decode_int(blob, offset, schema)
        elif t == "float":
            return struct.unpack_from('<f', blob, offset)[0]
        elif t == "double":
            return struct.unpack_from('<d', blob, offset)[0]
        elif t == "vector3":
            x, y, z = struct.unpack_from('<ddd', blob, offset)
            return {"x": x, "y": y, "z": z}
        elif t == "list":
            return self.decode_list_at(blob, offset, schema)
        elif t == "dict":
            # Nested dict: decode sub-blob starting at offset
            # Sub-blob size = next u32 at offset
            sub_size = struct.unpack_from('<I', blob, offset)[0]
            sub_blob = blob[offset+4:offset+4+sub_size]
            return self.decode_dict_blob(sub_blob, schema)
        elif t == "enum":
            size = schema.get("size", 1)
            raw_val = self.decode_uint(blob, offset, size)
            if schema.get("readEnumValue", False):
                inv = {v: k for k, v in schema.get("values", {}).items()}
                return inv.get(raw_val, raw_val)
            return raw_val
        else:
            return f"<unknown type: {t}>"

    # ------------------------------------------------------------------
    # OBJECT
    # ------------------------------------------------------------------
    def decode_object(self, blob: bytes, offset: int, schema: dict) -> dict:
        """
        Object layout (empirically confirmed across all 284 regions):

          [fixed_fields: endOfFixedSizeData bytes]
          [optional_bits: u32]         if optionalValueLookups non-empty
          [unknown_field: u32]         usually 0; purpose TBD
          [offset_table: n_entries*u32]
          [var_data ...]

        Where:
          n_entries  = popcount(optional_bits) + n_non_optional_var_attrs
          var_data_start = offset + end_fixed + 4(opt) + 4(unknown) + n_entries*4

        Table is ordered by ascending attributesWithVariableOffsets schema index,
        including only present optional attrs and all non-optional attrs.
        Absent optional attrs are simply omitted — no sentinel entries.

        Special case for simple string-only objects (end_fixed=0, no optionals, 1 var):
          Layout is: [0:u32][0:u32][0:u32][str_len:u32][chars]
          → var_data_start = offset + 12 (3 zero u32s before the string)

        Edge case:
          Some large/complex objects appear to omit the 4-byte unknown field entirely,
          so the offset table starts immediately after optional_bits. We try the normal
          layout first, then safely retry without that extra 4-byte separator if the
          first decode attempt looks structurally invalid.
        """
        attrs = schema.get("attributes", OrderedDict())
        const_offsets = schema.get("constantAttributeOffsets", {})
        var_attrs = schema.get("attributesWithVariableOffsets", [])
        opt_lookups = schema.get("optionalValueLookups", {})
        end_fixed = schema.get("endOfFixedSizeData", 0)

        result = {}

        # Decode fixed-size fields
        for attr_name, attr_schema in attrs.items():
            if attr_name in const_offsets:
                field_offset = offset + const_offsets[attr_name]
                result[attr_name] = self.decode_record(blob, field_offset, attr_schema)

        if not var_attrs:
            return result

        # Read optional bits
        optional_bits = 0
        if opt_lookups:
            optional_bits = struct.unpack_from('<I', blob, offset + end_fixed)[0]

        # Build ordered list of present variable attrs (schema index order)
        # Non-optional attrs always included; optional attrs only if present
        present_var_attrs = []
        for attr_name in var_attrs:
            if attr_name in opt_lookups:
                if optional_bits & opt_lookups[attr_name]:
                    present_var_attrs.append(attr_name)
            else:
                present_var_attrs.append(attr_name)

        n_entries = len(present_var_attrs)

        # Special case: simple single-string objects (eventtypes pattern)
        # end_fixed=0, no optionals → 3 zero u32s before string data
        if end_fixed == 0 and not opt_lookups and n_entries == 1:
            for i, attr_name in enumerate(present_var_attrs):
                attr_schema = attrs.get(attr_name, {"type": "string"})
                rel_offset = struct.unpack_from('<I', blob, offset + 4 + i*4)[0]
                abs_offset = offset + 12 + rel_offset
                self._validate_record_at(blob, abs_offset, attr_schema)
                result[attr_name] = self.decode_record(blob, abs_offset, attr_schema)
            return result

        fallback_unknown_size = 0 if (end_fixed > 0 and opt_lookups) else None
        var_result = self._decode_object_variable_attrs(
            blob,
            offset,
            attrs,
            present_var_attrs,
            end_fixed,
            opt_lookups,
            unknown_size=4,
            fallback_unknown_size=fallback_unknown_size,
        )
        result.update(var_result)
        return result

    def _decode_object_variable_attrs(
        self,
        blob: bytes,
        offset: int,
        attrs: dict,
        present_var_attrs: list,
        end_fixed: int,
        opt_lookups: dict,
        unknown_size: int,
        fallback_unknown_size: int = None,
    ) -> dict:
        """Decode variable-offset object fields, with optional alternate anchor fallback."""
        try:
            return self._decode_object_variable_attrs_once(
                blob,
                offset,
                attrs,
                present_var_attrs,
                end_fixed,
                opt_lookups,
                unknown_size,
            )
        except (ValueError, struct.error, UnicodeDecodeError) as first_error:
            if fallback_unknown_size is None or fallback_unknown_size == unknown_size:
                raise
            try:
                return self._decode_object_variable_attrs_once(
                    blob,
                    offset,
                    attrs,
                    present_var_attrs,
                    end_fixed,
                    opt_lookups,
                    fallback_unknown_size,
                )
            except (ValueError, struct.error, UnicodeDecodeError):
                raise first_error

    def _decode_object_variable_attrs_once(
        self,
        blob: bytes,
        offset: int,
        attrs: dict,
        present_var_attrs: list,
        end_fixed: int,
        opt_lookups: dict,
        unknown_size: int,
    ) -> dict:
        opt_size = 4 if opt_lookups else 0
        table_start = offset + end_fixed + opt_size + unknown_size
        n_entries = len(present_var_attrs)
        table_end = table_start + n_entries * 4
        var_data_start = table_end

        if table_start < 0 or table_end > len(blob):
            raise ValueError("variable offset table out of bounds")

        result = {}
        for i, attr_name in enumerate(present_var_attrs):
            attr_schema = attrs.get(attr_name, {"type": "string"})
            rel_offset = struct.unpack_from('<I', blob, table_start + i*4)[0]
            abs_offset = var_data_start + rel_offset
            self._validate_record_at(blob, abs_offset, attr_schema)
            result[attr_name] = self.decode_record(blob, abs_offset, attr_schema)

        return result

    def _validate_record_at(self, blob: bytes, offset: int, schema: dict):
        """Cheap structural validation so bad anchors trigger fallback instead of garbage."""
        if offset < 0 or offset >= len(blob):
            raise ValueError(f"record offset out of bounds: {offset}")

        t = schema.get("type")
        if t in ("string", "resPath"):
            self._validate_string_at(blob, offset)
        elif t == "int":
            size = schema.get("size", 4)
            if offset + size > len(blob):
                raise ValueError(f"int out of bounds at {offset}")
        elif t == "float":
            if offset + 4 > len(blob):
                raise ValueError(f"float out of bounds at {offset}")
        elif t == "double":
            if offset + 8 > len(blob):
                raise ValueError(f"double out of bounds at {offset}")
        elif t == "vector3":
            if offset + 24 > len(blob):
                raise ValueError(f"vector3 out of bounds at {offset}")
        elif t == "enum":
            size = schema.get("size", 1)
            if offset + size > len(blob):
                raise ValueError(f"enum out of bounds at {offset}")
        elif t == "list":
            if offset + 4 > len(blob):
                raise ValueError(f"list header out of bounds at {offset}")
            if schema.get("fixedItemSize"):
                count = struct.unpack_from('<I', blob, offset)[0]
                fixed_size = schema.get("fixedItemSize", 0)
                if offset + 4 + count * fixed_size > len(blob):
                    raise ValueError(f"fixed-size list out of bounds at {offset}")
            else:
                sub_size = struct.unpack_from('<I', blob, offset)[0]
                if offset + 4 + sub_size > len(blob):
                    raise ValueError(f"list sub-blob out of bounds at {offset}")
        elif t == "dict":
            if offset + 4 > len(blob):
                raise ValueError(f"dict header out of bounds at {offset}")
            sub_size = struct.unpack_from('<I', blob, offset)[0]
            if offset + 4 + sub_size > len(blob):
                raise ValueError(f"dict sub-blob out of bounds at {offset}")

    def _validate_string_at(self, blob: bytes, offset: int):
        if offset + 4 > len(blob):
            raise ValueError(f"string header out of bounds at {offset}")
        slen = struct.unpack_from('<I', blob, offset)[0]
        if offset + 4 + slen > len(blob):
            raise ValueError(
                f"implausible string length {slen} at {offset} for blob size {len(blob)}"
            )

    # ------------------------------------------------------------------
    # LIST
    # ------------------------------------------------------------------
    def decode_list_blob(self, blob: bytes, schema: dict) -> list:
        """Decode a top-level list blob."""
        return self.decode_list_at(blob, 0, schema)

    def decode_list_at(self, blob: bytes, offset: int, schema: dict) -> list:
        """
        List layout:
          [count: u32][item0][item1]...  (if fixedItemSize)
          [blob_size: u32][items_blob]   (if no fixedItemSize)
        """
        item_schema = schema.get("itemTypes", {"type": "int", "size": 4})
        fixed_size = schema.get("fixedItemSize")

        if fixed_size:
            count = struct.unpack_from('<I', blob, offset)[0]
            result = []
            for i in range(count):
                item_offset = offset + 4 + i * fixed_size
                result.append(self.decode_record(blob, item_offset, item_schema))
            return result
        else:
            blob_size = struct.unpack_from('<I', blob, offset)[0]
            sub_blob = blob[offset+4:offset+4+blob_size]
            # Parse items until exhausted (variable-size items)
            result = []
            pos = 0
            while pos < len(sub_blob):
                try:
                    item = self.decode_record(sub_blob, pos, item_schema)
                    result.append(item)
                    # Advance by item size (strings are len-prefixed)
                    if item_schema.get("type") == "string":
                        slen = struct.unpack_from('<I', sub_blob, pos)[0]
                        pos += 4 + slen
                    else:
                        pos += item_schema.get("size", 4)
                except Exception:
                    break
            return result

    # ------------------------------------------------------------------
    # PRIMITIVES
    # ------------------------------------------------------------------
    def decode_string_at(self, blob: bytes, offset: int) -> str:
        self._validate_string_at(blob, offset)
        slen = struct.unpack_from('<I', blob, offset)[0]
        return blob[offset+4:offset+4+slen].decode("utf-8", errors="replace")

    def decode_int(self, blob: bytes, offset: int, schema: dict) -> int:
        size = schema.get("size", 4)
        min_val = schema.get("min", None)
        fmt = {1: '<b', 2: '<h', 4: '<i', 8: '<q'}.get(size, '<i')
        val = struct.unpack_from(fmt, blob, offset)[0]
        if min_val is not None:
            val += min_val
        return val

    def decode_uint(self, blob: bytes, offset: int, size: int) -> int:
        fmt = {1: '<B', 2: '<H', 4: '<I', 8: '<Q'}.get(size, '<I')
        return struct.unpack_from(fmt, blob, offset)[0]

    def decode_float(self, blob: bytes, offset: int) -> float:
        return struct.unpack_from('<f', blob, offset)[0]


# ------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------
if __name__ == "__main__":
    import sys, json

    decoder = FSDDecoder()
    for path in sys.argv[1:]:
        print(f"\n=== {path} ===")
        try:
            result = decoder.decode_file(path)
            if isinstance(result, dict):
                print(f"Dict: {len(result)} entries")
                for k, v in list(result.items())[:5]:
                    print(f"  {k}: {v}")
            elif isinstance(result, list):
                print(f"List: {len(result)} items, first 5: {result[:5]}")
            else:
                print(result)
        except Exception as e:
            print(f"ERROR: {e}")
            import traceback; traceback.print_exc()
