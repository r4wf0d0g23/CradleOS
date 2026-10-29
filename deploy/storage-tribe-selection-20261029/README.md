# Storage tribe selection — 2026-10-29

Raw supplied a player screenshot: sharing NOT ENABLED, Tribes mode, empty tribe
field, generic invalid-fields error; player could only withdraw own deposits.

Added explicit **Add my tribe** to owner configuration, using the connected
Character's supported read. Does not infer a hardcoded tribe or grant access.
Preserves manual IDs, avoids duplicate tribe, and rejects missing tribe, failed
read, changed wallet/network and stale identity generation. Empty Tribes mode
now asks for a tribe ID; hybrid pilots-only mode remains valid. Placeholder no
longer resembles a configured tribe. Wallet review/consent/signing unchanged.

The owner must Review configuration and Sign & apply. Then authorized pilots
can Deposit all personal stock from their own personal partition into the
shared pool. The owner cannot appropriate other pilots' personal stock; no
configuration or stock transfer was signed during this work. Owner-main stock
is not moved by this personal-partition deposit action.

13 sandboxed browser fixture checks pass, including current-character lookup,
empty input, preservation/deduplication, no tribe, failed read, disconnect,
review/sign guards, deposit and withdraw PTBs, narrow widths. Simulated reads
and wallet are explicitly labelled. Live-data browser uses a read-only
synthetic wallet: it verifies actual Tauriskus tribe98000666 is selected and
reaches owner review without signing. Actual EVE Vault/player transfers remain
unverified. Contracts, registry, transfer hook and vulnerable-witness quarantine
are unchanged. Independent native scoped review passed.

Live Pages cb41d5f2 / source4dec4a7; production read-only check passed at
2026-10-29T14:55:08Z. Combined web receipt: ../partner-metrics-20261029/release.json.
