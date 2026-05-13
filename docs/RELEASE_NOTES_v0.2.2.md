# Release v0.2.2

## Summary

This patch clarifies the default operating model: local knowledge starts as personal/local knowledge, and a periodic local automation task decides what can be safely submitted to the LS / MCP team memory review queue.

## What Changed

- Added `docs/LOCAL_AGENT_AUTOMATION.md`.
- Clarified that local knowledge is not automatically team knowledge.
- Clarified that the model is not default double-write: local save is personal memory, LS submission is a screened candidate flow.
- Defined `memory:ls:maintain` as the local automation loop.
- Added rules for skipping sensitive content and explicit `do_not_upload` / `local_only` / `personal_only` items.
- Clarified that the automation should fully sync reviewed LS knowledge to local cache.
- Clarified that local usage feedback should summarize which LS knowledge was useful, ignored, missed, corrected, blocked, duplicated, or conflicted.
- Updated README, rollout docs, local setup, MCP implementation docs, AGENTS template, and local project template.

## Key Rule

Local is the personal working memory and cache. LS / MCP is the team source of truth. Automation moves only safe candidates upward and reviewed team knowledge downward.
