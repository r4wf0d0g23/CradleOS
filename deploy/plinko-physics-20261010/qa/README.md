# Verification scope

Run `verify.mjs` against a built preview using QA_BASE and QA_TAG; HTTPS selects four live natural-RNG cases instead of the twelve-case preview suite. It drives the actual app and checks DOM-frame movement, upward rebounds, contacts, ball separation, exact committed endpoints, unchanged session ledger and motion/hidden/resize/reload/profile boundaries.

`fixtures.mjs` exercises the actual component with engine-generated deterministic extreme/alternating/mixed rounds. To reproduce locally, copy component-fixture to cradleos-dapp/.plinko-qa and use a task-owned Vite dev server on5216. Do not ship that fixture in product source. The fixture is archived here and the original development directory/server removed after capture.

CONTACT sheets are compact visual indexes; full-resolution PNGs and video remain local and ignored. Native independent review inspected both contact sheets and extracted video frames. Development's first actual-app attempt stopped at an ambiguous test selector (stake10 versus ballcount10); selector was scoped to the options fieldset. Only final complete preview/live reports count as passing app runs. No test-only randomness is injected into the actual app; deterministic paths are scoped to component fixtures and unit tests.
