---
name: gift-intel
description: Use when the user needs gift or gesture recommendations, like "what should I get [name]", "gift ideas for [name]", "[name]'s birthday is coming up", "gift history for [name]", "what have I given them before", "what do they like", "avoid duplicate gifts", "best thoughtful gesture for [name]", "Christmas gift for [name]", "holiday gift", or "thank you gift for [name]".
allowed-tools:
  - mcp__plugin_crm_crm__crm_search
  - mcp__plugin_crm_crm__crm_outline
  - mcp__plugin_crm_crm__crm_read
  - mcp__plugin_crm_crm__crm_update
  - mcp__plugin_crm_crm__crm_log
  - mcp__plugin_crm_crm__crm_connections
  - mcp__plugin_crm_crm__crm_vector_search
  - mcp__plugin_crm_crm__crm_stats
  - mcp__plugin_crm_crm__crm_recent
  - mcp__plugin_crm_crm__crm_audit
  - mcp__plugin_crm_crm__crm_repair
  - mcp__plugin_crm_crm__crm_export
  - mcp__plugin_crm_crm__crm_bulk_update
  - mcp__plugin_crm_crm__crm_create
  - AskUserQuestion
---

## Purpose
Gift and gesture intelligence: preferences, past gifts, and context-aware recommendations.

## Workflow
1. Run `crm_search` to resolve the contact.
2. Run `crm_read` with `section="profile"` for interests, hobbies, and explicit preferences.
3. Run `crm_read` with `section="intelligence-profile"` for personality traits and values that shape gift fit.
4. Run `crm_vector_search` with queries like `"[name] gift"` and `"[name] birthday"` to find prior gift mentions.
5. Run `crm_read` with `section="log"` to validate details and reactions from prior gestures.
6. Synthesize options that are varied, non-redundant, and tied to known preferences.

## Output Template
```markdown
# Gift Intelligence: [Name]

## Past Gifts & Gestures
| Date | Occasion | Gift/Gesture | Their Reaction |
|------|----------|-------------|:---------------:|
[from log entries]

## Known Preferences
- Interests: [from profile]
- Values: [from intelligence-profile]
- Dislikes/Avoid: [if mentioned anywhere]

## Suggested Gift Ideas
1. **[Idea]** — [reasoning tied to their profile]
2. **[Idea]** — [reasoning]
3. **[Idea]** — [reasoning]

## Budget Context
[Business contact: appropriate gift range for the relationship level]
[Family: no budget guidance needed]
```

## Edge Cases
- **No gift history:** If no past gifts are found in logs or vector search, state this clearly and rely entirely on profile interests and personality for recommendations.
- **Noisy vector search:** If `crm_vector_search` returns too many low-relevance hits, rely on log scanning instead.

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
