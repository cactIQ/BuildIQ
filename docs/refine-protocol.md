# Refine loop protocol (render–inspect–refine)

Adapted from WorldClaw §2.2.3 and §2.3.3. The budgets and stop rules are our own, because the paper states none.

## Roles
- **Orchestrator** (main agent): owns the issue queue, budgets, checkpoint commits and `refine/log.jsonl`.
- **Shooter:** `python tools/shoot.py --round N` (plus `--debug ids` when grounding is in doubt). Deterministic.
- **Critic:** a fresh-context agent per round. It sees ONLY:
  - `shots/rN/*.compare.png`
  - `shots/rN/report.json`
  - `_internal/observed.json` (if present)
  - this checklist
  - the open issue list

  It never sees code or change summaries.
- **Fixer:** the owner of the affected module (or the orchestrator for core).

## Critic output: `shots/rN/critique.json`
```json
{ "round": 2, "views": { "elevation": {
    "checklist": [{ "item": "floor_count", "result": "pass|fail|na", "evidence": "..." }],
    "issues": [{ "id": "ELEV-007", "status": "new|open|fixed|regressed|wontfix",
      "category": "fidelity|realism|grounding|scale|artefact|product|compliance|perf",
      "severity": "blocker|major|minor", "observation": "...", "reference_evidence": "...",
      "region": { "x": 0.42, "y": 0.18, "w": 0.2, "h": 0.6 }, "spec_path": "towers[0].cornices",
      "proposed_fix": { "type": "param|local-code|rewrite", "detail": "..." },
      "acceptance": "...", "confidence": 0.8 }] } },
  "verdict": "continue|stop" }
```

## Checklist per view
- **Fidelity:** floor count; bay sequence; cornice cadence; attic/pediment form; rear tower length; gate form;
  pool/plaza layout; clubhouse form; colour and value of the facade.
- **Realism:** texel density consistent; glass reads as glass with depth; shadows grounded; no floating or buried
  objects; vegetation distribution natural (not a grid); no z-fighting or shimmer; sky, env and sun consistent;
  exposure believable; no visible texture tiling.
- **Product:** the hero shot is pitch-worthy; framing; the UI is not in shot mode.

## Gates, budgets, stop rules
- **Hard gates** (machine-checked; the critic cannot override them): 0 console errors; `grounding.ok`; `npm test`
  passes; no "new shader program after ready" warning; budgets met.
- **Weights:** blocker 5, major 2, minor 1.
- **Attempts:** ≤3 per issue, then `wontfix` with a note for the owner.
- **Rounds per view:** hero, elevation, aerial and pool 4; aerialN and clubhouse 2; gym 1. 8 rounds overall.
- **Stop a view** on any of:
  - no blocker or major issues open
  - its budget is spent
  - a plateau: 2 rounds without a drop in the weighted score
- **Regression:** a higher weighted score or a broken gate means revert to the last checkpoint commit and mark the
  issue `regressed`.
- **Order within a round:** architecture/objects → grounding/support → lighting/atmosphere.

## Log: `refine/log.jsonl` (one line per attempt)
`{round, issue_id, view, fixer, fix_type, files, spec_diff, commit, weighted_before, weighted_after, gates, result, note}`
