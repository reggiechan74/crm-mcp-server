---
name: life-event-support
description: Use when the user needs guidance responding to major life events, including "[name] just [life event]", "[name]'s [relative] passed away", "[name] got promoted", "[name] is getting married", "[name] had a health scare", "how should I respond to [name]'s [event]", "what should I say to [name]", or "help me handle this sensitively".
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
model: default
---

## Purpose
Context-aware response guidance for significant life events, with sensitivity to relationship depth and personal context.

## Workflow
1. Run `crm_search` to resolve the contact.
2. Run `crm_read` on `index`, `profile`, and `intelligence-profile` to assess relationship depth, cultural context, and personal style.
3. Run `crm_connections` to identify mutual contacts who may need coordinated outreach.
4. Run `crm_read` with `section="log"` for recent interaction context.
5. Build immediate, short-term, and ongoing response guidance with concrete wording and follow-up cadence.
6. Offer to log the event and set reminders for follow-up touchpoints.

## Output Template
```markdown
# Life Event Response: [Name] — [Event]

## Relationship Context
[How close you are, how long you've known them, last interaction]

## Cultural Considerations
[from profile — ethnicity, religion, cultural norms that affect appropriate response]

## Suggested Response
**Immediate (Today):**
[specific action — call, text, card, flowers, etc. with suggested wording]

**Follow-Up (1-2 Weeks):**
[check-in action]

**Ongoing:**
[longer-term support if applicable]

## People to Notify
| Contact | Their Relationship | How to Tell Them |
|---------|-------------------|-----------------|
[mutual contacts from crm_connections who should know]

## Recommended Next Actions
1. [Offer to log this event to the contact's CRM dossier via `crm_log`]
2. [Set calendar reminder for follow-up check-in at appropriate interval]
3. [Notify mutual contacts who should know — coordinate outreach if needed]
4. [Schedule longer-term follow-up touchpoint if applicable]
```

## Tone & Sensitivity
This skill must sound warm and human, not clinical. For grief, illness, or loss, lead with empathy and gentle language. For milestones like promotions, weddings, or new babies, lead with sincere celebration and specific support.

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
