# Specs index

## Current

| Doc | Status |
| --- | --- |
| [01-design-context.md](01-design-context.md) | Current: product intent and the no-false-claims constraints |
| [02-design-system.md](02-design-system.md) | Current: the design tokens the Tailwind config is built from |
| [03-developer-handoff.md](03-developer-handoff.md) | **Partly replaced.** Design, component and page guidance stands; its backend, API, data-model and deployment sections are replaced by doc 10 |
| [10-Fan-Director-Implementation-Plan.md](10-Fan-Director-Implementation-Plan.md) | **Current direction** for a real app: Cloudflare Pages + Worker + D1 + R2, platform-paid AI behind an adapter, server-authoritative pricing, versioned Scene Cards. *Proposed*: start with its Phase 0 |

The visual ground truth remains `docs/design-html/` (PDF copies in `docs/design-pdfs/`).
The PDFs in `docs/specs-pdf/` are snapshots of 01–03 taken before the
replacement markings were added.

## Replaced and removed (2026-09-16)

These described a backend that was never built (Express/Node, PostgreSQL +
Flyway, AWS S3/CloudFront/ECS/RDS, Docker, React 18). They contradict doc 10
and were removed together with their PDFs in `docs/specs-pdf/`.

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
