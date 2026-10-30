# Independent source review

Reviewer: existing native gate_architecture_review session (not Opus).

Initial finding: root checkpoint freshness was insufficient to prove event-index freshness. Corrected EVENT_QUERY and parser to require the event-filter availableRange last checkpoint. Regressions prove a fresh root head cannot make a stale event index Current or populate the ticker; missing/malformed event watermarks reject.

Final verdict: PASS — blocker resolved. No remaining source-review blockers; release conditional on updated suite/build and fresh preview checks.

Reviewed: exact event allowlist and tenant/package provenance; route endpoint and currency proofs; neutral labels and occurred/recorded times; pagination/cursor/overlap guards; shared polling, cancellation and history suspension; retained labelled failures; typed metadata; pause/reduced-motion; read-only App/Gate navigation integration. Historical route events intentionally unavailable if their gate objects cannot be verified.
