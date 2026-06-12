# Quiz Generator — Ubiquitous Language

A glossary of domain terms for the RAG quiz generator. Terms here are canonical: use them in code, UI copy, and docs.

## Document

A source file uploaded by a User — PDF, plain text, or Markdown, at most 5MB. Text is extracted from it in the browser (client-side); the server only ever receives the extracted text plus metadata, never the original binary.

A Document moves through a lifecycle: **pending** (uploaded, not yet processed) → **processing** (topics and chunks being derived) → **ready** (available for Quiz generation) or **failed** (processing can be retried). Only ready Documents can back a Quiz.

## Knowledge Base

The collection of all of a User's ready Documents, queried as a single body of knowledge. Quizzes draw on the whole Knowledge Base, not on one Document. Each User has exactly one Knowledge Base.

## Topic

A high-level subject extracted from Document text by an LLM. Topics belong to the Knowledge Base and are merged by name: if two Documents both yield "Neural Networks", the User sees one Topic linked to both Documents (many-to-many). A Topic disappears when the last Document linked to it is deleted. Topics are what the User picks from when requesting a Quiz.

## Chunk

A contiguous slice of a Document's extracted text, sized for retrieval. Chunks are what get embedded (semantic search) and indexed (keyword search). Every Chunk belongs to exactly one Document.

## Quiz

A set of multiple-choice questions generated on demand from Chunks retrieved across the User's entire Knowledge Base, scoped by the User's selected Topics, difficulty, and question count. Quizzes are generated, never authored from scratch — but after generation a User may **save** a Quiz, **curate** it (edit, reorder, or delete individual questions), and **export** it for use outside the app. Importing external question sets is out of scope (see roadmap).
