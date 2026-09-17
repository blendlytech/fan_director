# Specs index

## Current

| Doc | Status |
| --- | --- |
| [01-design-context.md](01-design-context.md) | Current: product intent and the no-false-claims constraints |
| [02-design-system.md](02-design-system.md) | Current: the design tokens the Tailwind config is built from |
| [03-developer-handoff.md](03-developer-handoff.md) | **Partly replaced.** Design, component and page guidance stands; its backend, API, data-model and deployment sections are replaced by doc 10 |
| [10-Fan-Director-Implementation-Plan.md](10-Fan-Director-Implementation-Plan.md) | **Current direction** for a real app: Workers Static Assets (was Pages) + Worker + D1 + R2, platform-paid AI behind an adapter, server-authoritative pricing, versioned Scene Cards |
| [11-Developer-Handoff-Phases-0-3.md](11-Developer-Handoff-Phases-0-3.md) | **Approved scope for the next build**: doc 10 Phases 0–3 with review gates, plus the decided catalog model (categories, starter and creator items, unpriced custom requests, commission options such as exclusivity and rush delivery), boundaries (a fixed platform hard list enforced server-side; creator limits set to "Ask me" or "Hard no"; real adults only, with status roles allowed), the child-exploitation safety case, and adult content that is built and gated behind platform, per-creator and compliance switches, including the AI path |
| [12-Shooting-Scripts.md](12-Shooting-Scripts.md) | **Approved direction, not scheduled**: creator-only AI shooting scripts from an approved Scene Card, revised with the creator's notes, plus an erotic after-shoot letter to the fan that the creator approves (Phase S, after Gate 4). Qwen3 235B primary, DeepSeek V3.2 fallback; output contract, scope and limit checks, quality gate read by the owner |

The visual ground truth remains `docs/designs/html/`; see
[../README.md](../README.md) for the design list.

PDF copies of the designs and specs 01–03 were removed on 2026-09-17 (the spec
PDFs predated the replacement markings). Recover one with
`git show 2c60e43:docs/design-pdfs/<file>` or `git show 2c60e43:docs/specs-pdf/<file>`.

## Replaced and removed (2026-09-16)

These described a backend that was never built (Express/Node, PostgreSQL +
Flyway, AWS S3/CloudFront/ECS/RDS, Docker, React 18). They contradict doc 10
and were removed together with their PDFs.

| Removed doc | Replaced by |
| --- | --- |
| 04-api-specification.md | Doc 10 §3–5 (Worker endpoints, lifecycle, records) |
| 05-database-schema.md | Doc 10 §5 (D1 records and workflow) |
| 06-postman-collection.md | None yet: API tests follow once doc 10 Phase 1 defines the Worker API |
| 07-github-actions.md | Doc 10 §8 and §10 (staging-first release; CI not yet designed) |
| 08-implementation-checklist.md | Doc 10 §8–9 (phases and launch checklist) |
| 09-pdf-export-package.md | Nothing: it only packaged the docs above |

To read a removed doc, use the last commit that contained it:

```bash
git show 6e22606:docs/specs/04-api-specification.md
```
