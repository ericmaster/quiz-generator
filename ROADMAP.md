# Roadmap

## Current posture: Cloudflare Workers Free plan

The app is designed to run entirely on free tiers (Workers Free, D1, Vectorize, Workers AI free quotas, OpenRouter free models). Design constraints this imposes:

- No Cloudflare Queues (paid-only) — ingestion runs via `waitUntil`/Workflows instead.
- 10ms CPU per request — all heavy work must be I/O-bound (LLM calls, embedding calls); document parsing stays client-side.
- D1: 500MB per database, 5GB total.
- 100k requests/day.

## Upgrade triggers (move to Workers Paid, $5/mo)

Upgrade when any of these is hit as the user base grows:

| Signal | Why upgrade helps |
|---|---|
| Ingestion failures / stuck documents under load | Queues give durable, retryable background processing |
| D1 database approaching 500MB | Paid raises cap to 10GB per database |
| Workers AI embedding quota exhausted (daily neurons) | Paid raises Workers AI quotas |
| >100k requests/day | Paid removes the daily request cap |
| OpenRouter free-model rate limits degrade quiz generation UX | Budget for paid OpenRouter models (separate spend from Cloudflare) |

## Later ideas (not scheduled)

- DOCX upload support (mammoth.js client-side).
- Import question sets (the inverse of Phase 7 export): validation, dedup, and "quiz without source document" semantics.
- Re-chunking pipeline driven from R2 raw text (no re-upload needed — raw text is already persisted per Document).
- Paid judge/generation models for the evaluation framework.
