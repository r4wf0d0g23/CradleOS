import hashlib
import json
import os
from pathlib import Path
import sys

root = Path(__file__).resolve().parent
proof = json.loads((root / 'inputs.json').read_text())
for row in proof['files']:
    assert hashlib.sha256((root / row['file']).read_bytes()).hexdigest() == row['sha256']
with os.add_dll_directory(str(root / 'runtime')):
    sys.path.insert(0, str(root / 'runtime'))
    import iconIDsLoader
    table = iconIDsLoader.load(str(root / 'data/iconids.fsdbinary'))
    result = {}
    for key, obj in table.items():
        result[str(key)] = {name: getattr(obj, name) for name in dir(obj) if not name.startswith('_')}
    dest = root / 'icons-decoded.json'
    dest.write_text(json.dumps(result, sort_keys=True), encoding='utf-8')
    print(json.dumps({'count': len(result), 'sha256': hashlib.sha256(dest.read_bytes()).hexdigest()}))
