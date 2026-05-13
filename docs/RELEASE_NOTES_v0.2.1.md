# Release v0.2.1

## Summary

This patch adds explicit local-agent guidance for recognizing reusable knowledge and submitting it to the MCP team memory review queue.

## What Changed

- Added `docs/AGENT_KNOWLEDGE_SUBMISSION_GUIDE.md`.
- Defined what counts as reusable knowledge.
- Added rules for when a local AI agent should submit knowledge.
- Added templates for `memory.submit_knowledge` and `memory.submit_principle_candidate`.
- Clarified what must stay local and what must never be uploaded.
- Updated README, rollout docs, MCP implementation docs, and AGENTS templates to point agents to the guide.

## Key Rule

Local agents may submit candidates, but they must not mark their own submissions as accepted or write directly to formal principles. Human maintainers remain the review gate.
