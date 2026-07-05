# Opencode Toolkit

A collection of AI-powered development tools for [opencode](https://opencode.ai). Includes **skills** (slash commands with custom behavior) and **rules** (global instructions loaded automatically).

## Available Skills

| Skill | Description |
|-------|-------------|
| `address-pr-comments` | Triage PR comments, filter noise, apply the useful ones, commit and push, and resolve all related threads. |
| `commit` | Create a semantic commit from staged/unstaged changes following Conventional Commits. |
| `ship` | Commit, push, and create/update a PR — uses the repo's PR template and creates a ticket-based branch when run from main. |

## Available Rules

| Rule | Description |
|------|-------------|
| `always-use-context7` | Automatically invoke Context7 MCP for library/API documentation and code-related questions. |
| `no-code-comments` | Prevent comments from being added to code unless explicitly asked. |
| `no-abbreviations` | Prevent abbreviations in code and names unless explicitly asked. |

## Installation

### Automated (Recommended)

Run the install script from the repo root to selectively install skills and rules:

TBD

### Manual

Add the skills and rules to your `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "skills": {
    "paths": ["/path/to/this/repo/skills"]
  },
  "instructions": [
    "/path/to/this/repo/rules/always-use-context7.md",
    "/path/to/this/repo/rules/no-code-comments.md",
    "/path/to/this/repo/rules/no-abbreviations.md"
  ]
}
```

### Install locations

```
~/.config/opencode/opencode.jsonc    ← skills.paths and instructions configured here
~/.config/opencode/skills/           ← skills copied here
```

This repo structure:

```
skills/
  address-pr-comments/SKILL.md
  commit/SKILL.md
  ship/SKILL.md
rules/
  always-use-context7.md
  no-code-comments.md
  no-abbreviations.md
```

## Usage

Once installed, skills are available as slash commands:

```
/address-pr-comments
/commit
/ship
```

Rules are loaded automatically in every conversation.

## Adding New Items

### Adding a Skill

1. Create a new directory under `skills/` with the skill name.
2. Add a `SKILL.md` file with frontmatter containing `name` and `description`:

```markdown
---
name: my-skill
description: Short description of what the skill does.
---

Skill instructions go here...
```

3. Add the `skills/` path to `skills.paths` in `opencode.jsonc` if not already configured.

### Adding a Rule

1. Add a `.md` file under `rules/` with the rule name (e.g. `rules/my-rule.md`).
2. Write the instructions as plain markdown (no frontmatter needed):

```markdown
Instructions that should always be followed...
```

3. Add the file path to `instructions` in `opencode.jsonc`.
