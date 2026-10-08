# Native service operations review — 2026-10-08

## Verdict: PASS for bounded service-source gate; deployment qualification remains separate

This is an inherited native-model review, not an Opus review. Runtime, systemd and Tailscale configuration were not changed. Review covers the three native runner sources and proposed user units; prior browser/controller gates are not repeated.

### O1 — RESOLVED: abrupt runner exit previously bypassed the cleanup-required gate

`supervise.py` checks the shared gate before each job, but after `child.poll()` returns it only inspects the exit code. A SIGKILL/OOM of `run_stream.py` can therefore release the render lock without a verified native receipt. Supervisor exits nonzero, and `Restart=on-failure` may retry after systemd terminates remaining children; successful cgroup termination is not the promised verified Wine cleanup.

Isolated exact-source probe with a fake child returning -9 after creating a job: supervisor exited -9, retained the unverified job, and **did not write the cleanup gate**. No Wine/native renderer was launched. Evidence: `review-probes/supervisor-abrupt-before.json`.

Original required correction: independently validate each completed job's unique matching `wine_cleanup: true` receipt before allowing restart, even while stopping. Persist a service-owned in-progress marker before spawning; on startup an uncleared marker must fail closed, covering whole-supervisor/cgroup kill. Clear it only after qualified cleanup is verified. Preserve failures for operator inspection, rather than automatically deleting/clearing their markers.

### Independent correction verification

The current supervisor atomically installs `active-run.json` before Popen, checks interrupted-run evidence at startup, and verifies cleanup after every child exit, including shutdown. Missing/invalid receipt evidence preserves the active marker and writes the shared cleanup gate. A missing job is safely treated as preflight-only because `run_stream.py` creates the job before it can launch native processes. Receipt validation rejects non-object JSON; rotation uses the same checked helper.

**17/17 isolated exit/startup cases passed**, including -9 exits, missing/bad/array/null/false receipts, interrupted startup, invalid sentinel JSON/path, verified cleanup, preflight failures and preservation of a pre-existing shared gate. Every simulated spawn asserted that the marker had already been installed. Evidence: `review-probes/supervisor-gates.py` and `.json`. Retention recheck also passed with malformed/unverified jobs retained and external native-runtime symlink target unchanged.

Latest reviewed supervisor SHA256: `bb68805a9d1874ca6485e4606a71f8f390e0ae3464314f41b5844ca09098c542`.

No remaining hard source blocker was found for installing the bounded user units and proceeding to the separate capped pilot qualification. This is not a claim that units or public streaming were exercised by this reviewer.

## Passed source checks

- User-unit syntax accepted by `systemd-analyze --user verify` (both units). Render uses `KillMode=mixed`, 150-second stop deadline; supervisor writes shared cleanup gate after 90 seconds without graceful stop. Gateway has a 10-second stop deadline. Render restart has a three-attempt/300-second limiter.
- Render lifetime is fixed to 28,800 seconds in the proposed unit. Native loop checks monotonic lifetime and a private IPC shutdown file. Outer wait adds 240 seconds; copied qualified harness gets its own lifetime+120 bound. Long-running initialization remains under the harness's existing bounded bootstrap subprocess calls.
- Wrapper holds the existing global render lock and rejects the shared cleanup gate. Original native binaries/resources are referenced through prepared-host symlinks; modified probe/harness, Wine prefix, HOME, Xauthority, runtime copies and logs belong to the generated job. Qualified `wineserver -k/-w` targets that private prefix; there is no broad process-name kill.
- Native frame files are fixed per-slot names and atomically replaced. Heartbeat is atomic; camera samples are bounded by the finite round lifetime. No per-frame recording accumulation. Native Win32 window is destroyed in `finally`.
- Independent retention fixture proves verified old job removed, receipt archived, unverified job retained, newest two jobs retained, and original-runtime content behind a prepared-host symlink untouched. Evidence: `review-probes/supervisor-retention.json`.
- Current production IPC directory was read-only inspected as owner `rawdata`, mode0700. No install or cleanup command was performed.

## Operational qualifications / follow-up

- Retention removes verified old generated job trees, not failure evidence. Receipt archive is intentionally cumulative; this is not a fixed total-disk quota. Malformed or non-object receipt JSON is now skipped by rotation, retaining those files for operator attention.
- Existing IPC directories are not revalidated for owner/mode/symlinks in code. The inspected directory is private; rejecting unexpected ownership/symlinks would strengthen future deployment portability.
- Environment lifetime is parsed as an integer without a range limit. The proposed fixed unit is bounded; operator overrides should remain positive and <=28,800 seconds.
- A successful review of service source is not evidence that actual systemd stop/restart, eight-hour rotation, public Funnel delivery, or an EVE embedded browser works. Those remain deployment qualification checks. Parent's current stream04 graceful receipt should be retained before installing/replacing assets.
- Funnel must remain isolated to10000. Previously observed private Serve listeners4174,443,8443 must remain unchanged; do not reset global Tailscale state. No public configuration was modified by this reviewer; the source gate does not replace the parent’s specific deployment authorization or post-install qualification.
