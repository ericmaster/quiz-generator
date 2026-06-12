# 1. Better Auth over Auth.js for authentication

Date: 2026-06-12

## Status

Accepted

## Context

The RAG revamp plan originally specified Auth.js with its D1 adapter (`@auth/sveltekit` + `@auth/d1-adapter`). That path is documented and works, but `@auth/sveltekit` has been officially marked experimental for years, and Auth.js development is in slow-maintenance mode. Most tutorials and examples still assume Auth.js, so a future reader will wonder why this project deviates.

Alternatives considered: Auth.js (documented but stagnant), Better Auth (actively developed, first-class SvelteKit integration, D1 support via Drizzle/Kysely), and hand-rolled Lucia-style sessions (maximum control, most code to audit).

## Decision

Use **Better Auth** with its SvelteKit integration and a D1-compatible database adapter for all authentication (GitHub/Google OAuth, sessions).

## Consequences

- Auth schema tables are defined by Better Auth's adapter conventions, not Auth.js's — migration between the two later means rewriting session handling and remapping user tables.
- Documentation lookups must target Better Auth docs; Auth.js examples found online will not apply directly.
- We depend on Better Auth's release cadence for Cloudflare Workers compatibility fixes, which has been good to date.
