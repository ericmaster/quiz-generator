# RAG Quiz Generator Revamp Plan

This document outlines the phased implementation plan for transforming the existing statically generated Quiz SPA into a fully functional RAG (Retrieval-Augmented Generation) application deployed on Cloudflare Workers.

## Architecture Overview
- **Framework**: SvelteKit with `@sveltejs/adapter-cloudflare`
- **Auth**: Better Auth with Cloudflare D1 (chosen over Auth.js — `@auth/sveltekit` is experimental and Auth.js is in maintenance mode)
- **Database/Vector**: Cloudflare D1 (FTS5 for keyword) + Cloudflare Vectorize (for semantic)
- **Raw text storage**: Cloudflare R2 (one object per Document — D1 caps rows at 2MB, extracted text can reach 5MB; R2 enables re-chunking without re-upload)
- **Document Parsing**: Client-side parsing via `unpdf` (note: `pdf-lib` was ruled out — it creates/modifies PDFs but cannot extract text)
- **Inference**: OpenRouter free models via an ordered fallback chain (configured priority list using OpenRouter's `models` array; Phase 8 evaluation informs the ordering). API key stored as a Wrangler secret.
- **Plan tier**: Cloudflare Workers Free plan (see `ROADMAP.md` for upgrade triggers — no Queues, 10ms CPU/request, free-tier D1/Vectorize/Workers AI quotas)

---

## Phase 1: Foundation & SvelteKit Migration
### Status: `[x] Completed`

**Description:** 
Migrate the existing Vite SPA to a SvelteKit application targeting Cloudflare Workers with Static Assets (not Pages — Pages is in maintenance mode). Setup the basic routing structure.

**Tasks:**
- Install SvelteKit, `@sveltejs/adapter-cloudflare`, and configure `svelte.config.js`.
- Move existing `src/App.svelte` logic to SvelteKit routing (`src/routes/+page.svelte`).
- Configure `wrangler.jsonc` (Workers + Static Assets) for local development.

**Tests Implementation:**
- Setup Vitest or Playwright.
- Basic routing tests to ensure the homepage renders without errors.

**Subagent Delegation (Code Review & Testing):**
- **Action:** Delegate a subagent to review the `svelte.config.js` and `vite.config.js` for optimal Cloudflare worker build settings.
- **Testing:** Subagent should run `npm run build` and `npm run preview` to verify that the adapter-cloudflare successfully builds the application without SSR errors.

**Definition of Done:**
- [x] Application runs locally via `npm run dev`.
- [x] Application builds successfully via adapter-cloudflare.
- [x] The quiz-taking UI (Questions/Result components) works in SvelteKit routes. (The static manifest.json/data-folder quiz mode is dropped — see Phase 7 for the saved-quiz replacement.)

---

## Phase 2: Authentication & Database Setup
### Status: `[x] Completed`

**Description:** 
Implement user authentication using Better Auth and setup the Cloudflare D1 database schema for users, sessions, documents, and topics.

**Tasks:**
- Define D1 schema (Users, Sessions, Documents, Topics, Chunks with FTS5, Quizzes, Questions).
  - Note: D1 supports FTS5, but databases containing virtual tables cannot be exported — drop/recreate the FTS table around any `wrangler d1 export` backup.
- Initialize D1 database via Wrangler.
- Install and configure Better Auth with its SvelteKit integration and a D1-compatible database adapter.
- Setup OAuth providers (GitHub/Google).

**Tests Implementation:**
- Write integration tests for D1 schema creation.
- Mock Better Auth session to test protected routes.

**Subagent Delegation (Code Review & Testing):**
- **Action:** Delegate a subagent to review the D1 SQL schema for proper FTS5 virtual table setup and foreign key constraints.
- **Testing:** Subagent runs local wrangler D1 commands to execute the schema and test inserting/querying dummy user data.

**Definition of Done:**
- [x] D1 database is provisioned locally and schema is applied.
- [x] Users can log in and log out using Better Auth.
- [x] Protected routes correctly redirect unauthenticated users.

---

## Phase 3: Client-side Document Parsing & Storage
### Status: `[x] Completed`

**Description:** 
Implement client-side parsing of Documents (PDF, plain text, or Markdown) to extract raw text, enforcing a 5MB file size limit to avoid overwhelming the system. PDFs are parsed via `unpdf`; text/Markdown are read directly via FileReader.

**Tasks:**
- Install `unpdf` for client-side extraction (`pdf-lib` cannot extract text).
- Create an upload UI component that handles file selection and text extraction.
- Implement an API route (`/api/upload`) to receive the extracted text, store the raw text as an R2 object, and save the document metadata to D1.
- Provision an R2 bucket and binding in `wrangler.jsonc`.

**Tests Implementation:**
- Unit tests for the client-side parsing utility function using dummy PDF ArrayBuffers.
- API route tests using mock text payloads.

**Subagent Delegation (Code Review & Testing):**
- **Action:** Delegate a subagent to perform a security and performance review of the client-side extraction logic.
- **Testing:** Subagent should test the UI upload flow with a large PDF to verify the 5MB size limit rejection works and extraction succeeds for smaller files.

**Definition of Done:**
- [x] Users can upload a PDF up to 5MB.
- [x] The browser successfully extracts text and sends it to the server.
- [x] Document metadata is stored in D1 and raw text is stored in R2.

---

## Phase 4: AI Integration & Topic Extraction
### Status: `[ ] Not Started`

**Description:** 
Integrate OpenRouter to process the uploaded text, extract topics, and chunk the text for vectorization. Processing runs in the background via `ctx.waitUntil` after the upload response returns; the Document carries a status (`pending` → `processing` → `ready` / `failed`) that the UI polls, with a manual retry endpoint for failures (no Queues on the free plan).

**Tasks:**
- Setup OpenRouter API utility in `src/lib/server/ai`.
- Add Document status lifecycle (pending/processing/ready/failed) to the D1 schema, a status polling endpoint, and a retry endpoint for failed processing.
- Create a prompt to extract high-level topics from document text.
- Implement text chunking logic (e.g., recursive character text splitting).
- Save extracted topics to D1, merged by name within the user's Knowledge Base (Topics ↔ Documents is many-to-many; a topic with no remaining document links is deleted).

**Tests Implementation:**
- Unit tests for text chunking functions (verifying chunk size and overlap).
- Mock OpenRouter API calls to test topic extraction parsing.

**Subagent Delegation (Code Review & Testing):**
- **Action:** Delegate a subagent to review the prompt engineering for topic extraction and the chunking algorithm's efficiency.
- **Testing:** Subagent provides a sample text block to the chunker and topic extractor, verifying the outputs meet expected formats.

**Definition of Done:**
- [ ] Uploaded text is automatically chunked.
- [ ] OpenRouter successfully returns topics for the text.
- [ ] Topics and Chunks are saved to D1.

---

## Phase 5: Hybrid Search Pipeline (Vectorize + D1 FTS5)
### Status: `[ ] Not Started`

**Description:** 
Embed the chunks using Cloudflare AI, store them in Vectorize, and implement the hybrid search retrieval pipeline.

**Tasks:**
- Setup Cloudflare Vectorize index, including metadata indexes on `user_id` and `document_id` (metadata indexes must be created before vectors are inserted for filtering to work).
- Generate embeddings for chunks using Cloudflare's multilingual embedding model `@cf/baai/bge-m3` (1024 dims — chosen over `bge-small-en-v1.5` because documents may be non-English; the Vectorize index must be created with matching dimensions).
- Insert embeddings into Vectorize and chunks into D1 FTS5 table.
- Implement the retrieval function: Query Vectorize (semantic) + Query D1 FTS5 (keyword).
- Implement Reciprocal Rank Fusion (RRF) to combine results.
- (Optional) Apply an OpenRouter instruct model to re-rank the final results.

**Tests Implementation:**
- Unit test the RRF ranking algorithm.
- Integration test for inserting and querying the local Vectorize and D1 instances.

**Subagent Delegation (Code Review & Testing):**
- **Action:** Delegate a subagent to review the Vectorize insertion batching and the RRF algorithm for correctness.
- **Testing:** Subagent runs a mock search query to ensure both D1 and Vectorize results are merged and ranked properly.

**Definition of Done:**
- [ ] Chunks are successfully embedded and stored.
- [ ] Hybrid search function returns relevant chunks for a given user query.

---

## Phase 6: Quiz Generation & UI Integration
### Status: `[ ] Not Started`

**Description:** 
Allow the user to select topics, difficulty, and question count. Use the hybrid search pipeline to retrieve context and generate the final quiz.

**Tasks:**
- Build the UI for selecting topics (across the user's whole Knowledge Base), difficulty, and question count.
- Create `/api/quiz/generate` endpoint.
- Retrieval strategy: each selected Topic's name is used as the hybrid-search query, filtered to the Documents linked to that Topic (Vectorize metadata filter + SQL join on the topic-document links).
- Formulate the OpenRouter generation prompt incorporating retrieved context chunks.
- Return the generated Q/A pairs as a complete, server-side-validated response (JSON schema check + answer-must-be-in-options check); the UI shows a progress indicator while generating. No streaming in v1.
- Handle updates: Wipe old chunks/topics, Vectorize vectors, and the R2 raw-text object if the source document is modified or deleted.

**Tests Implementation:**
- Test the API endpoint with mocked retrieval results to ensure prompt generation is correct.
- E2E test of the UI selection to quiz generation flow.

**Subagent Delegation (Code Review & Testing):**
- **Action:** Delegate a subagent to review the final LLM prompt context injection and response validation logic.
- **Testing:** Subagent performs an end-to-end simulated run of selecting topics and verifying the generated quiz structure.

**Definition of Done:**
- [ ] User can generate a quiz based on selected topics.
- [ ] Questions accurately reflect the uploaded document context.
- [ ] Deleting/updating a source cleans up related database rows and vectors.

---

## Phase 7: Quiz Persistence, Curation & Export
### Status: `[ ] Not Started`

**Description:** 
Let users save generated Quizzes, curate them (edit/reorder/delete individual questions), and export them. The legacy static-JSON quiz mode is dropped; the existing quiz-taking UI (Questions/Result components) is reused for generated quizzes.

**Tasks:**
- Add Quizzes and Questions tables to D1 (owned by the user, linked to source Topics/Documents).
- Save a generated Quiz; list and reopen saved Quizzes.
- Curation UI: edit question text/options/answer/explanation, reorder, delete questions.
- Export endpoint producing a rich JSON format (questions plus topics, difficulty, source document references, timestamps).

**Tests Implementation:**
- CRUD tests for quiz/question persistence.
- Export format snapshot test.

**Subagent Delegation (Code Review & Testing):**
- **Action:** Delegate a subagent to review the export schema and curation endpoints for authorization (users can only touch their own quizzes).
- **Testing:** Subagent saves, edits, and exports a quiz end-to-end and validates the exported JSON structure.

**Definition of Done:**
- [ ] Generated quizzes can be saved, reopened, curated, and exported.
- [ ] Export file contains questions with topic, difficulty, and source metadata.

---

## Phase 8: Evaluation Framework (LLM-as-a-judge)
### Status: `[ ] Not Started`

**Description:** 
Implement an evaluation pipeline to test different free OpenRouter models against a ground-truth Q/A set.

**Tasks:**
- Create an offline Node script (not an admin route — avoids Workers request limits and free-model rate-limit pressure mid-request) that imports the same pipeline modules used by the app.
- Take a provided source document and expected Q/A JSON.
- Run the extraction, retrieval, and generation pipeline for a configured list of free OpenRouter models.
- Judge: invoke Claude Code in headless mode (`claude -p --model claude-opus-4-8 --output-format json`) as the LLM-as-a-judge, scoring Answer Accuracy, Faithfulness, and Context Precision. Runs with adaptive thinking at Claude Code's default effort (xhigh) — eval runs are small and infrequent, so judgment quality is prioritized over cost. Uses the existing Claude subscription; no separate judge API key.
- Output results to a markdown or JSON report; feed the ranking back into the OpenRouter fallback-chain ordering (Phase 6).

**Tests Implementation:**
- Unit test the evaluation scoring functions (parsing the Judge's output).

**Subagent Delegation (Code Review & Testing):**
- **Action:** Delegate a subagent to review the prompt used for the "Judge" model to ensure it isn't biased.
- **Testing:** Subagent executes the evaluation script with a dummy dataset to verify the metrics are calculated and reported accurately.

**Definition of Done:**
- [ ] Script successfully runs a source document and expected Q/A through the pipeline.
- [ ] A final report is generated ranking the models based on the defined metrics.
