---
name: headroom
description: >-
  Context window headroom preservation and token budget management skill.
  Enforces progressive reading, token-dense outputs, chunked refactoring,
  and anti-context-exhaustion protocols so the agent never degrades or hallucinates
  due to context saturation. Activate when performing large refactors, multi-step audits,
  or working with large files.
---

# Headroom: Context Window & Token Budget Management

Headroom protects the agent's working memory by preventing context window bloat, token exhaustion, and attention degradation.

## Core Directives

### 1. Progressive Disclosure (Never Dump Full Files)
- When reading code, always use targeted line slices (`StartLine`, `EndLine`) or exact grep searches instead of ingesting entire 1000+ line files at once.
- Only load the context relevant to the active task.
- Never output massive multi-page raw logs or code dumps when an excerpt or targeted diff suffices.

### 2. High-Density Communication
- Strip filler, pleasantries, and self-congratulatory preamble.
- State facts, decisions, and exact code changes with high information density.
- Do not repeat entire files back to the user when changing only a few lines; use surgical replacements.

### 3. Chunked Execution for Complex Tasks
- Break large refactors into discrete atomic steps.
- Validate each step before proceeding to the next.
- Keep intermediate summaries concise so residual context retains ample headroom for future prompt turns.

### 4. Zero Memory Leaks in Context
- Never re-summarize artifacts that were already written to disk.
- Point to created artifacts and filepaths directly.
- Ensure terminal commands limit paging (`-n 10`, `Select-Object -First 20`).
