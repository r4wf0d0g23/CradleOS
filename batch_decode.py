#!/usr/bin/env python3
"""
Batch decoder for EVE Frontier static data.
Loads .schema YAML files as external schemas for .static files.
Outputs decoded data as JSON files.

Usage: python3 batch_decode.py <staticdata_dir> [output_dir] [file_filter...]
"""

import os, sys, json, yaml, struct, pickle, time
sys.path.insert(0, os.path.dirname(__file__))
from fsd_decoder import FSDDecoder


def load_yaml_schema(schema_path: str) -> dict:
    """Load and return a YAML schema file."""
    with open(schema_path) as f:
        return yaml.safe_load(f)


def decode_static_with_schema(decoder: FSDDecoder, data_path: str, schema: dict):
    """Decode a .static file using an external YAML schema."""
    with open(data_path, 'rb') as f:
        data = f.read()

    top_type = schema.get('type')

    if top_type == 'list':
        # List format: [count: u32][items...]
        fixed_size = schema.get('fixedItemSize')
        item_schema = schema.get('itemTypes', {})

        if fixed_size:
            count = struct.unpack_from('<I', data, 0)[0]
            results = []
            for i in range(count):
                offset = 4 + i * fixed_size
                if offset + fixed_size > len(data):
                    break
                item = decoder.decode_record(data, offset, item_schema)
                results.append(item)
            return results
        else:
            # Variable-size list
            blob_size = struct.unpack_from('<I', data, 0)[0]
            sub_blob = data[4:4+blob_size]
            return decoder.decode_list_blob(sub_blob, schema)

    elif top_type == 'dict':
        # Dict format: the entire file IS the blob (no schema prefix)
        # The keyFooter is at the end of the data
        value_schema = schema.get('valueTypes', {})
        return decoder.decode_dict_blob(data, schema)

    elif top_type == 'object':
        return decoder.decode_object(data, 0, schema)

    else:
        raise ValueError(f"Unknown top-level schema type: {top_type}")


def json_default(obj):
    """Handle non-serializable types."""
    if isinstance(obj, bytes):
        return obj.hex()
    if isinstance(obj, float):
        if obj != obj:  # NaN
            return None
        if obj == float('inf'):
            return "Infinity"
        if obj == float('-inf'):
            return "-Infinity"
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 batch_decode.py <staticdata_dir> [output_dir] [file_filter...]")
        sys.exit(1)

    data_dir = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(data_dir, 'decoded')
    filters = sys.argv[3:] if len(sys.argv) > 3 else []

    os.makedirs(output_dir, exist_ok=True)
    decoder = FSDDecoder()

    # Collect all files to process
    files = sorted(os.listdir(data_dir))
    # Group by base name
    file_groups = {}
    for f in files:
        base, ext = os.path.splitext(f)
        if base not in file_groups:
            file_groups[base] = {}
        file_groups[base][ext] = f

    stats = {'success': 0, 'fail': 0, 'skip': 0}

    for base, exts in sorted(file_groups.items()):
        if filters and not any(filt in base for filt in filters):
            continue

        # Skip non-data files
        data_exts = [e for e in exts if e in ('.static', '.fsdbinary', '.pickle')]
        if not data_exts:
            stats['skip'] += 1
            continue

        data_ext = data_exts[0]
        data_file = os.path.join(data_dir, exts[data_ext])
        schema_file = os.path.join(data_dir, base + '.schema') if '.schema' in exts else None

        file_size = os.path.getsize(data_file)
        print(f"\n{'='*60}")
        print(f"Decoding: {exts[data_ext]} ({file_size:,} bytes)")
        if schema_file:
            print(f"  Schema: {base}.schema")

        t0 = time.time()
        try:
            if data_ext == '.pickle':
                with open(data_file, 'rb') as f:
                    result = pickle.loads(f.read())
            elif schema_file and data_ext == '.static':
                schema = load_yaml_schema(schema_file)
                result = decode_static_with_schema(decoder, data_file, schema)
            else:
                result = decoder.decode_file(data_file)

            elapsed = time.time() - t0

            # Summary
            if isinstance(result, dict):
                n = len(result)
                print(f"  Result: dict with {n} entries ({elapsed:.2f}s)")
                # Show first 3 entries
                for i, (k, v) in enumerate(result.items()):
                    if i >= 3:
                        print(f"  ... and {n - 3} more")
                        break
                    v_str = str(v)[:120]
                    print(f"  [{k}]: {v_str}")
            elif isinstance(result, list):
                n = len(result)
                print(f"  Result: list with {n} items ({elapsed:.2f}s)")
                for item in result[:3]:
                    print(f"  - {str(item)[:120]}")
                if n > 3:
                    print(f"  ... and {n - 3} more")
            else:
                print(f"  Result: {type(result).__name__} ({elapsed:.2f}s)")

            # Write JSON
            out_path = os.path.join(output_dir, base + '.json')
            with open(out_path, 'w') as f:
                json.dump(result, f, indent=2, default=json_default, ensure_ascii=False)
            print(f"  Saved: {out_path} ({os.path.getsize(out_path):,} bytes)")
            stats['success'] += 1

        except Exception as e:
            elapsed = time.time() - t0
            print(f"  FAILED ({elapsed:.2f}s): {e}")
            import traceback
            traceback.print_exc()
            stats['fail'] += 1

    print(f"\n{'='*60}")
    print(f"Done! Success: {stats['success']}, Failed: {stats['fail']}, Skipped: {stats['skip']}")


if __name__ == '__main__':
    main()
