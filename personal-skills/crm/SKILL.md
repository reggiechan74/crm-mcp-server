---
name: crm
description: Bare /crm shortcut for the CRM plugin — looks up a person or organization in the CRM index. Installed by /crm:setup.
argument-hint: "[name, company or dossier code] [optional question]"
disable-model-invocation: true
---

Use the Skill tool to invoke `crm:lookup` with args: $ARGUMENTS

Then follow that skill exactly. If `crm:lookup` is not available, the CRM plugin is missing or out of date — tell the user to run `/crm:setup`.
