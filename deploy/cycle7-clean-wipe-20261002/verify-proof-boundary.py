#!/usr/bin/env python3
"""Compile a hostile external package: neither Voting proof factory may be public.

Usage: python3 verify-proof-boundary.py /absolute/path/to/sui
No signing, network transaction, or source mutation.
"""
import pathlib
import subprocess
import sys
import tempfile

repo = pathlib.Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix="cycle7-proof-boundary-") as directory:
    root = pathlib.Path(directory)
    (root / "sources").mkdir()
    (root / "Move.toml").write_text(f'''[package]
name = "attacker"
edition = "2024"
[dependencies]
cradleos_voting = {{ local = "{repo / 'cradleos_voting'}" }}
[environments]
testnet_stillness = "4c78adac"
''')
    (root / "sources/forgery.move").write_text('''module attacker::forgery {
    public fun forge_eligibility(ctx: &mut TxContext) {
        let _proof = cradleos_voting::voting::mint_eligibility_proof(
            sui::object::id_from_address(@0x42), ctx.sender(), 42, 0,
            @cradleos_voting, true, ctx);
        abort 0
    }
    public fun forge_weight(ctx: &mut TxContext) {
        let _proof = cradleos_voting::voting::mint_weight_proof(
            sui::object::id_from_address(@0x42), ctx.sender(), 42, 0,
            @cradleos_voting, 999999, vector[], ctx);
        abort 0
    }
}
''')
    result = subprocess.run([sys.argv[1], "move", "build", "--path", str(root), "--build-env", "testnet_stillness"],
                            cwd=root, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    text = result.stdout
    if result.returncode == 0 or "mint_eligibility_proof" not in text or "mint_weight_proof" not in text or "visibility" not in text.lower():
        print(text)
        raise SystemExit("FAIL: expected explicit visibility errors for BOTH proof factories")
    print("PASS: external package cannot construct eligibility or arbitrary-weight proofs")
