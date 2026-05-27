# Implementation Report

## Environment

- Python 3.10+ recommended, Python 3.9 used locally for dependency compatibility
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

## File Structure

```text
backend/app/
|-- config.py
|-- database.py
|-- models.py
|-- schemas.py
|-- seed.py
|-- seed_enhanced.py
|-- routers/
|   |-- auth.py
|   |-- products.py
|   |-- orders.py
|   |-- analytics.py
|   |-- recommendations.py
|   `-- admin.py
`-- services/
    |-- analytics.py
    `-- event_logger.py
```

## Implementation Notes

- Auth path updates `last_login_at` and no longer fails hard when audit logging is unavailable
- SQLite local URLs are normalized to a deterministic backend path
- Lightweight SQLite column migrations allow incremental schema enrichment without forcing a clean reset every run
- New seed path generates realistic users, products, orders, reviews, search logs, sessions, marketing objects, suspicious activities, and caches
- Analytics layer supports RFM, cohorts, funnel, geography, anomaly detection, stockout risk, churn risk, and hybrid recommendation outputs

## AI Tool Usage Log

### Tools

| Tool | Primary Usage | Frequency |
| --- | --- | --- |
| Cursor / Claude Code style agent | Refactor planning, backend implementation, documentation drafting | Daily during build |
| GitHub Copilot | Local line-level completion and boilerplate | Frequent |
| Chat-style LLM | Design review, query shaping, report drafting | Frequent |

### Efficiency Analysis

| Task | Without AI | With AI | Gain |
| --- | --- | --- | --- |
| Schema scaffolding | 4-5 hours | 1.5-2 hours | High |
| Analytics endpoint boilerplate | 3 hours | 1 hour | High |
| Report structure drafting | 2 hours | 30 minutes | Medium |
| Debugging auth/runtime issue | Uncertain | Faster root-cause isolation | High |

### Case Study 1

- 【Problem Description】
  Login showed "failed to fetch" even though the backend was running.
- 【AI Suggestion】
  Inspect the backend login path and validate whether the failure occurred after credential verification rather than before it.
- 【Adoption】☑ Fully Adopted / ☐ Partially Adopted / ☐ Not Adopted
- 【Final Solution】
  The issue was traced to event logging committing against a read-only SQLite handle. The logger was wrapped to fail safely and the SQLite path was normalized.
- 【Reflection】
  The useful part was not generic guessing but narrowing the fault to a specific commit path.

### Case Study 2

- 【Problem Description】
  The original schema was too shallow for cohort, RFM, recommendation, and inventory analytics.
- 【AI Suggestion】
  Expand the domain additively and introduce SQLite-safe column migration helpers instead of rewriting the whole persistence layer at once.
- 【Adoption】☑ Fully Adopted / ☐ Partially Adopted / ☐ Not Adopted
- 【Final Solution】
  User, product, order, marketing, and analytics support tables were added while preserving existing routers.
- 【Reflection】
  AI helped propose a migration-safe path rather than a destructive rewrite.

### Case Study 3

- 【Problem Description】
  Capstone analytics required realistic data volume, but manual test records were too sparse.
- 【AI Suggestion】
  Use `Faker`, temporal distributions, geographic clustering, and seasonal bias to generate orders, events, reviews, and search logs.
- 【Adoption】☑ Fully Adopted / ☐ Partially Adopted / ☐ Not Adopted
- 【Final Solution】
  `seed_enhanced.py` now generates 500+ users, 200+ products, 2000+ orders, and event-heavy behavior data.
- 【Reflection】
  AI is effective when the target realism constraints are explicit.

## Reflection on AI-Assisted Programming

AI assistance materially improved delivery speed, but only when used as a force multiplier rather than as an autonomous source of truth. The most useful pattern was iterative narrowing: define a concrete problem, inspect the local code, ask for a focused transformation, then verify the result manually. For example, the login failure did not require broad speculation about auth, CORS, or frontend state once the actual runtime symptom was traced to a database write during event logging. That kind of bug isolation still depended on engineering judgment, local reproduction, and reading the stack path carefully.

AI was also helpful for structural work. Expanding a small e-commerce demo into a richer capstone system requires many repetitive but related changes: adding entities, matching schemas, designing seed logic, and exposing new analytics endpoints. An AI assistant reduces the cost of this breadth, especially for draft-level scaffolding. It can propose table families, suggest how to preserve backward compatibility, and accelerate documentation. That said, raw AI output is rarely production-ready on first pass. It often misses compatibility issues, uses the wrong defaults, or introduces imports and fields that do not align with the actual runtime. The engineer still has to perform consistency checks across models, routers, services, and seed scripts.

Incorrect AI suggestions are unavoidable. A common pattern is overconfident completeness: the generated structure looks comprehensive but silently ignores migration constraints, data integrity, or existing frontend contracts. Another frequent issue is environment blindness. AI may propose code that is correct in principle but fails in the actual local toolchain, dependency set, or OS behavior. In this project, the sandboxed runtime and SQLite write behavior were just as important as the source code. The assistant became useful only after those local constraints were surfaced and respected.

AI does not replace a strong programmer, and it does not fully replace a junior developer either. It can automate boilerplate and accelerate exploration, but it does not own architecture tradeoffs, correctness accountability, integration risk, or acceptance criteria. The programmer's core competitiveness remains system understanding: reading existing code, detecting where abstractions leak, sequencing work, evaluating whether the generated solution is actually safe, and deciding what not to build yet. Those skills become more important, not less, when AI can generate large amounts of plausible code quickly.

Future AI utilization should be deliberate. The best strategy is to use it for schema drafts, test scaffolding, report templates, repetitive API wiring, and refactor suggestions, while reserving critical reasoning for data modeling, transaction safety, performance, deployment, and security review. In academic settings, AI can raise the ceiling of what one student can produce within a semester, but only if the student maintains authorship through review, validation, and adaptation. The measurable advantage is not merely faster coding; it is faster iteration toward a design that still has to be defended technically.
