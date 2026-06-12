# 2. Client-side document parsing; raw text persisted in R2

Date: 2026-06-12

## Status

Accepted

## Context

Documents (PDF, text, Markdown, ≤5MB) must be turned into text before chunking and embedding. The app runs on the Cloudflare Workers **Free plan** (10ms CPU per request), so CPU-heavy PDF parsing in the Worker is not viable. Separately, D1 caps any row/value at 2MB, while extracted text can reach 5MB — so "store the document text in a D1 column" silently breaks on large uploads.

## Decision

1. **Parse client-side.** The browser extracts text (`unpdf` for PDFs, FileReader for text/Markdown) and uploads only the extracted text plus metadata. The server never receives the original binary. Note: `pdf-lib` was ruled out — it creates/modifies PDFs but cannot extract text.
2. **Persist raw extracted text in R2**, one object per Document. D1 stores metadata, Topics, and Chunks (with FTS5); Vectorize stores embeddings.

## Consequences

- Worker CPU stays I/O-bound (LLM and embedding calls), fitting the free-plan limit.
- Re-chunking or re-processing a Document is possible from R2 without re-upload.
- Deleting a Document must cascade across three stores: D1 rows, Vectorize vectors, and the R2 object.
- Parsing fidelity depends on the user's browser; malformed PDFs fail at upload time rather than in a background job.
- Text extraction quality cannot be improved server-side later without moving parsing into the Worker (which would likely require the paid plan).
