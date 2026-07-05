---
name: ship
description: >
  Commit changes, push to remote, and create or update a pull request in one
  flow. Uses the `/commit` skill when available (otherwise follows Conventional
  Commits), and applies the repo's PR template when one exists. Trigger when
  the user asks to "ship", "commit and push", "open a PR", "push and create a
  PR", "update the PR", or any variant of the commit → push → PR flow.
---

# Ship: Commit, Push, and Create/Update PR

End-to-end flow that takes local changes all the way to an open (or updated)
pull request on the remote. Keep each phase explicit so the user can interrupt
at any point.

## Step 1 — Gather context and validate branch

Run these in parallel:

- `git status` — see what's changed (never use `-uall`)
- `git diff --staged` and `git diff` — see what will be committed
- `git branch --show-current` — current branch
- `git log --oneline -10` — recent commit style
- `git remote -v` — confirm an `origin` remote is configured
- `gh pr view --json number,url,headRefName,baseRefName,title,body` — detect
  an existing PR for this branch. Do NOT redirect stderr to `/dev/null`: check
  the exit status and inspect the error. Only treat it as "no existing PR"
  when `gh pr view` specifically reports that no pull request exists for the
  current branch. If it fails for any other reason (not authenticated, no
  GitHub remote, network error), surface the error to the user and stop.

If there are no changes AND no unpushed commits AND no existing PR, tell the
user there is nothing to ship and stop.

### If the current branch is main/master

Do NOT commit to main. Instead, create a dedicated branch driven by a ticket:

1. **Ask the user for a ticket link.** Request a URL to the ticket that
   motivates this change (Linear, Jira, GitHub Issue, etc.).

2. **Derive the branch name** from the ticket identifier and title. Format:
   `<type>/<id>-<short-slug>` where `<type>` is inferred from the work
   (`feat`, `fix`, `chore`, …). If the user can't provide a title, ask for a
   short description.

3. **Create and switch to the new branch** with `git checkout -b <branch>`.
   Confirm the branch name with the user before creating it if it looks
   ambiguous; otherwise proceed and report the name.

If the user explicitly refuses to create a new branch and insists on
committing to main, stop and require a second explicit confirmation before
continuing.

## Step 2 — Commit

Prefer the `/commit` skill if it is installed. Invoke it to create the commit.

If `/commit` is not available, follow the Conventional Commits spec directly:

- Format: `<type>(<scope>): <description>` — imperative, lowercase, no period,
  under 72 chars.
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
  `ci`, `chore`, `revert`. Append `!` for breaking changes.
- Stage files explicitly by name (never `git add -A` / `.`). Skip anything
  that looks like a secret (`.env`, credentials, keys) and warn the user.
- Use a HEREDOC for the message body.

If there are no uncommitted changes but there are unpushed commits or an
existing PR, skip committing and continue.

## Step 3 — Push

- If the branch has no upstream, push with `git push -u origin <branch>`.
- Otherwise, `git push`.
- Never force-push unless the user explicitly asks. If a normal push is
  rejected, stop and surface the error — do not reach for `--force` on your
  own.
- If the push triggers hooks that fail, fix the underlying issue rather than
  bypassing (`--no-verify`).

## Step 4 — Detect PR template

Before drafting PR content, look for a template the repo wants PRs to use.
Check these paths in order and use the first one found:

- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/pull_request_template.md`
- `docs/PULL_REQUEST_TEMPLATE.md`
- `PULL_REQUEST_TEMPLATE.md`
- Any file under `.github/PULL_REQUEST_TEMPLATE/` (multiple templates; pick
  the one that best matches the change, or ask the user if unclear)

If a template exists, the PR body MUST be built from that template. Fill in
every section you can from the diff and commit history. Leave placeholders
(e.g., `TBD`, or the template's own placeholder text) only where you truly
cannot infer the content — never invent test plans or context.

**Preserve the help section.** Many templates include a section with
instructions for the author (often titled "Help", "Guide", "Instructions",
"How to fill this out", or wrapped in HTML comments `<!-- ... -->`). Keep
these sections intact — do not strip them, even if they would normally be
considered boilerplate. If the template uses HTML comments as guidance, leave
those comments in the final PR body.

If no template exists, use this default body:

```markdown
## Summary
<1-3 bullet points on what changed and why>

## Test plan
- [ ] <verification steps>
```

If a ticket link was collected in Step 1, include a link reference to the
ticket in the PR body (e.g., `Closes LIN-123` or a Linear/Jira URL in the
summary), using whatever convention the template already suggests.

## Step 5 — Create or update the PR

First determine whether a PR already exists for this branch (from Step 1).

### If no PR exists — create one

- Title: short (under 70 chars). Derive from the primary commit subject,
  the ticket title (if available), or the overall theme of the changes.
- Body: the template-filled content from Step 4.
- Base branch: default to the repo's main branch unless the user specifies
  otherwise.

Create the PR with `gh pr create` using a HEREDOC for the body:

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
<body>
EOF
)"
```

### If a PR already exists — update it

- Re-run the body-building logic against the current state of the branch
  (new commits may have been added).
- Preserve any manual edits the user or reviewers made to the PR body where
  possible: if the existing body deviates significantly from the template,
  ask the user whether to overwrite it or just append a changelog-style
  update at the bottom.
- Update with `gh pr edit` using a HEREDOC (same structure as `gh pr create`),
  plus `--title` if the title materially changed:

  ```bash
  gh pr edit <number> --title "<title>" --body "$(cat <<'EOF'
  <body>
  EOF
  )"
  ```

- Never close and recreate a PR to "refresh" it.

## Step 6 — Report

Tell the user:

- The new branch name (if one was created from a ticket).
- The commit hash(es) created (if any).
- Push result and branch name.
- PR URL, and whether it was created or updated.
- Anything intentionally skipped (unstaged files, missing template sections
  filled with placeholders, etc.).

## Rules

- Never commit directly to main/master — always branch off via a ticket first.
- Never force-push without explicit permission.
- Never bypass hooks (`--no-verify`, `--no-gpg-sign`) without explicit
  permission.
- Never strip a template's help/guide/instruction section — even HTML comment
  blocks stay in.
- Never invent content (fake test plans, fake context) to fill template
  sections — use placeholders or ask the user.
- If `$ARGUMENTS` contains a hint (e.g., a ticket link, PR title, or base
  branch), use it — but still verify against the actual diff.
