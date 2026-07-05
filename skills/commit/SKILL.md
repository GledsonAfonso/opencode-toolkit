---
name: commit
description: Create a semantic commit from staged/unstaged changes. Use when the user asks to commit, save changes, or create a semantic commit.
---

# Semantic Commit

Create a well-structured semantic commit following the Conventional Commits specification.

## Step 1 — Gather context

Run these in parallel:

- `git status` — see what's changed (never use `-uall`)
- `git diff --staged` — see staged changes
- `git diff` — see unstaged changes
- `git log --oneline -10` — recent commits for style reference

## Step 2 — Analyze and classify

Determine the commit **type** from the changes:

| Type       | When to use                                      |
|------------|--------------------------------------------------|
| `feat`     | New feature or capability                        |
| `fix`      | Bug fix                                          |
| `docs`     | Documentation only                               |
| `style`    | Formatting, whitespace, semicolons (no logic)    |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement                          |
| `test`     | Adding or updating tests                         |
| `build`    | Build system or external dependencies            |
| `ci`       | CI configuration and scripts                     |
| `chore`    | Maintenance tasks, tooling, config               |
| `revert`   | Reverting a previous commit                      |

Determine the **scope** (optional) — the area of the codebase affected (e.g., `auth`, `api`, `ui`, `db`). Omit if the change is broad or the scope isn't meaningful.

Determine if the change is **breaking**. If so, append `!` after the type/scope.

## Step 3 — Draft the commit message

Format:

`<type>(<scope>): <description>`

[optional body]

[optional footer(s)]

Rules:
- **Description**: imperative mood, lowercase, no period, under 72 characters
- **Body**: explain *what* and *why*, not *how*. Wrap at 72 characters. Separate from subject with a blank line.
- **Footer**: include `BREAKING CHANGE: <explanation>` if breaking. Reference issues with `Closes #123` or `Fixes #456` if $ARGUMENTS mentions one.
- Do NOT include a body for small, self-explanatory changes — keep it to just the subject line.

## Step 4 — Stage and commit

- If nothing is staged and there are unstaged changes, stage the relevant files by name (never `git add -A` or `git add .`).
- Do NOT stage files that look like secrets (`.env`, credentials, keys).
- Warn the user and stop if you detect sensitive files.
- Create the commit using a HEREDOC:

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <description>

<optional body>
EOF
)"
```

- Run git status after to confirm success.

## Step 5 — Report

Show the user the final commit hash and message. If any files were intentionally left unstaged, mention them.

## Notes

- If $ARGUMENTS contains a hint about the change (e.g., /commit fix login bug), use it to inform the type and description but always verify against the actual diff.
- If there are no changes to commit, say so and stop.
- NEVER amend a previous commit unless the user explicitly asks.
- NEVER push unless the user explicitly asks.
