# Docs

Fan Director Studio is a design prototype. The only backend code is the Phase 1
staging Worker in `worker/` on the `staging/clerk-auth` branch, which isn't
provisioned or deployed. The specs below describe decisions and plans, not
running systems.

```
docs/
├── specs/            what to build and why
├── designs/
│   └── html/         visual ground truth, one file per design
└── reports/          phase reports, research and the Phase 0 AI test harness
```

## Where to start

1. [specs/01-design-context.md](specs/01-design-context.md): product intent and the no-false-claims rules.
2. [specs/02-design-system.md](specs/02-design-system.md): the design tokens.
3. [specs/11-Developer-Handoff-Phases-0-3.md](specs/11-Developer-Handoff-Phases-0-3.md): the approved scope for the next build.

[specs/README.md](specs/README.md) gives each spec's status (current, partly
replaced or removed). When sources disagree, follow doc 11's order of authority.

## Designs

Designs 01–12 are the demo's screens. Designs 13 onward are **staging designs**
for the backend build (doc 11 and doc 12), not screens in the demo.

| # | Design | Used by |
| --- | --- | --- |
| 01 | Component library | Demo |
| 02–09 | Boutique entrance, AI Director, review, send confirmation, creator dashboard and its modals | Demo |
| 10 | Saved ideas | Demo |
| 11 | Mobile menu | Demo |
| 12 | Page not found | Demo |
| 13 | Creator limits | Doc 11 |
| 14 | Fan account paused, restored and closed | Doc 11 |
| 15 | Safety-case review | Doc 11 |
| 16 | Sign-in and age verification | Doc 11 |
| 17 | AI Director live states | Doc 11 |
| 18 | Saving and price changes | Doc 11 |
| 19 | Unpriced custom request | Doc 11 |
| 20 | Commission options and starting templates | Doc 11 |
| 21 | Shooting-script workspace | Doc 12 |
| 22 | After-shoot letter | Doc 12 |
| 23 | News consent step after sign-up, and unsubscribe states (awaiting owner review) | Doc 11 |
| 24 | Phase 2 gaps: pricing note, fan nickname, script add/remove, resale conflict | Doc 11 |

## Reports

| Report | Notes |
| --- | --- |
| [reports/phase-0-report.md](reports/phase-0-report.md) | Astra's Gate 0 report plus addendum. The `phase-0-eval/` files it lists were never pushed. |
| [reports/phase-1-report.md](reports/phase-1-report.md) | Gate 1: backend foundation, rebuilt after Astra's workspace was lost, with the Gate 1 review's changes. Awaiting owner review. |
| [reports/phase-0-live/RESULTS.md](reports/phase-0-live/RESULTS.md) | Live model and classifier tests, rounds 1–4. The folder holds the runner scripts and test cases. Raw outputs in `results/` are gitignored. |
| [reports/custom-video-market-research.md](reports/custom-video-market-research.md) | Unsourced. Use it for seed defaults only, never for claims shown to users. |

New phase reports go in `reports/phase-N-report.md` (doc 11 §9).
