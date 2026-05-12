# Release v0.2.0

## Summary

This release redesigns Planner Memory Kit around an MCP team memory source of truth while keeping each local project on its existing SQLite / Markdown AI cache.

## What Changed

- Replaced the recommended Feishu Bitable mainline with an MCP team memory workflow.
- Added the full MCP implementation plan and data contract.
- Documented the local memory schema used by AI agents.
- Documented how AI should use memory at conversation start, during long tasks, and when users report missed recall.
- Added a new process diagram image: `docs/assets/team-memory-mcp-flow.svg`.
- Updated rollout, local project setup, AGENTS template, and E2E test plan.
- Kept Feishu sync as a legacy adapter for existing projects.

## Boundary

This repository does not implement the MCP server itself. It defines the connection contract, local cache responsibilities, workflow, safety gates, and project integration plan.

## Recommended Adoption

1. Keep local SQLite memory DB as the fast AI cache.
2. Use MCP team memory as the reviewed team source of truth.
3. Sync only reviewed, visible, non-frozen knowledge to local projects.
4. Push only aggregated usage feedback back to MCP.
5. Keep raw conversations, credentials, and runtime files local.
