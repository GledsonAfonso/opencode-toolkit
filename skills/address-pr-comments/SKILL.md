---
name: address-pr-comments
description: >
  Triage and address comments on a GitHub PR. Filters out noise (AI-generated,
  contradictory, or not-useful comments), shows a summary of proposed changes
  for approval, applies the approved changes, commits and pushes them, and
  then resolves ALL related review threads — including the ones intentionally
  skipped. Trigger when the user asks to "address PR comments", "handle PR
  feedback", "apply review comments", "resolve PR comments", or any variant
  of triaging and responding to reviewer feedback on a pull request.
---

# Address PR Comments

Triage all comments on the current PR, apply the ones that make sense, commit
and push, and resolve every related thread. Treat this as a four-phase flow:
**fetch → triage → apply → resolve**. The user approves between triage and
apply; do not skip that checkpoint.

## Step 1 — Identify the PR

Run these in parallel:

- `git branch --show-current` — current branch
- `gh pr view --json number,url,headRefName,baseRefName,title,author,state,isDraft`
  — detect the PR for this branch. Do NOT redirect stderr to `/dev/null`. If
  `gh pr view` reports no PR exists, stop and tell the user there is no PR to
  address on this branch. If it fails for any other reason (auth, network,
  non-GitHub remote), surface the error and stop.

If `$ARGUMENTS` contains a PR number or URL, use that instead of the current
branch's PR. Before fetching comments, `git fetch` and `git checkout` the PR's
head branch so commits land on the right branch.

If the PR is closed or merged, ask the user to confirm before continuing —
addressing comments on a merged PR usually means opening a follow-up.

## Step 2 — Fetch all comments

A GitHub PR has three comment surfaces. Fetch all three:

1. **Review comments** (inline, attached to specific lines):

   ```bash
   gh api "repos/{owner}/{repo}/pulls/{pr_number}/comments" --paginate
   ```

   Key fields per comment: `id`, `user.login`, `body`, `path`, `line`,
   `original_line`, `diff_hunk`, `in_reply_to_id`, `pull_request_review_id`,
   `created_at`.

2. **Issue comments** (general PR conversation, not tied to a line):

   ```bash
   gh api "repos/{owner}/{repo}/issues/{pr_number}/comments" --paginate
   ```

3. **Review threads with resolution state** (needed for Step 7). Use GraphQL
   because REST does not expose `isResolved`:

   ```bash
   gh api graphql -f query='
     query($owner:String!, $repo:String!, $number:Int!, $after:String) {
       repository(owner:$owner, name:$repo) {
         pullRequest(number:$number) {
           reviewThreads(first:100, after:$after) {
             pageInfo { hasNextPage endCursor }
             nodes {
               id
               isResolved
               isOutdated
               comments(first:100) {
                 pageInfo { hasNextPage }
                 nodes { id databaseId author { login } body path line }
               }
             }
           }
         }
       }
     }' -f owner=OWNER -f repo=REPO -F number=PR_NUMBER
   ```

   GraphQL does not auto-paginate. If `reviewThreads.pageInfo.hasNextPage` is
   true, loop using `endCursor` as `$after` until all threads are fetched. If
   any thread reports `comments.pageInfo.hasNextPage`, stop and tell the user —
   a thread with >100 replies needs nested pagination you should confirm
   before proceeding (rare, but silently truncating would violate the "resolve
   every thread" guarantee).

   The thread `id` (GraphQL node ID, not `databaseId`) is what Step 7 needs to
   resolve the thread. Map each REST review comment's `id` to its GraphQL
   thread via `comments.nodes[].databaseId`.

Skip threads where `isResolved` is already true — nothing to do there. Keep
track of every other thread: it must be resolved in Step 7 regardless of
whether its suggestion is applied.

## Step 3 — Triage

Triage applies to **review-thread comments** (surfaces 1 and 3 from Step 2).
Issue comments (surface 2) don't have a thread-resolve state; treat them as
context for the PR and only act on them if they contain a direct request —
in which case reply in-line in Step 7 rather than opening a thread.

For each unresolved review-thread comment, classify it into one of:

- **Apply** — actionable, correct, and makes the code better. Worth a code
  change.
- **Skip — noise** — AI-generated boilerplate, stylistic nitpicks the project
  doesn't care about, or feedback the user has previously pushed back on.
- **Skip — contradicts another comment** — two reviewers (or the same AI bot
  across runs) disagree. Pick the one that aligns with the codebase's
  conventions, or flag the conflict for the user to decide.
- **Skip — already addressed** — a later commit on the branch already fixed
  it, or the code no longer looks like the `diff_hunk` the comment was left
  on (check `isOutdated`).
- **Skip — out of scope** — valid feedback, but belongs in a follow-up PR
  (large refactor, unrelated bug, new feature request). Note these so the
  user can decide whether to file a ticket.
- **Needs clarification** — the comment is ambiguous or the intent isn't
  clear. Do NOT guess — flag for the user.

Heuristics for spotting AI-generated noise:

- Author login matches common bots (`coderabbitai`, `copilot-pull-request-reviewer`,
  `sourcery-ai`, `gemini-code-assist`, etc.) — treat as lower-signal by default,
  but still evaluate each comment on its merits.
- Generic phrasing ("Consider adding error handling", "This could be more
  robust") with no specific reasoning tied to the diff.
- Two comments on the same file that suggest opposite changes — pick one or
  skip both.
- Suggestions that conflict with patterns already established elsewhere in
  the repo.

Be conservative about skipping: when in doubt, include a comment in the
"apply" list rather than silently dropping it.

## Step 4 — Summarize and get approval

Before touching any files, present a summary to the user. Structure:

```
## PR #<number>: <title>

### Applying (<count>)
- <location> — <short description of change> — <reviewer>
- ...

### Skipping (<count>)
- <location> — <short description> — <reason: noise / contradicts / out of scope / already addressed> — <reviewer>
- ...

### Needs your input (<count>)
- <location> — <what's ambiguous> — <reviewer>
- ...
```

Use `<file>:<line>` for review-thread comments. For issue comments that lack
a file/line, use `(conversation)` or a short link to the comment URL so every
row is renderable.

Then ask the user to confirm before applying changes. Use the `question` tool
when the confirmation is binary; use a plain question when the user may want
to reclassify items.

If the user reclassifies any items, update the plan and re-summarize only the
deltas — do not re-dump the full summary.

## Step 5 — Apply the approved changes

Work through the "apply" list one comment at a time (or batched per file when
changes are tightly coupled):

- Read the file, make the edit, and verify the change matches the reviewer's
  intent. If the reviewer left a GitHub `suggestion` block (a fenced code
  block with the `suggestion` language tag), use that as the source of truth —
  but still sanity-check it against the current file contents, since
  suggestions can go stale.
- If applying one comment breaks another (e.g., a rename requested by one
  reviewer clashes with a signature requested by another), stop and ask the
  user rather than picking arbitrarily.
- Run any obvious local verification the repo has set up (type check, lint,
  tests for the changed area) when it's fast. If it's slow or unclear, skip
  and note it in the final report.
- Do NOT add unrelated refactors or cleanups along the way. Scope creep turns
  a review pass into a re-review.

## Step 6 — Commit and push

- Prefer the `/commit` skill if available. Otherwise follow Conventional
  Commits: `fix(scope): address review comments` or a more specific subject
  if the changes share a clear theme.
- Stage only the files you edited in Step 5. Never `git add -A` / `.`.
- Never bypass hooks (`--no-verify`) without explicit permission.
- Push to the existing upstream: `git push`. If the push is rejected, stop
  and surface the error — do not force-push on your own.

If the branch has diverged (reviewer pushed changes since you started), stop
and tell the user before force-pushing or rebasing.

## Step 7 — Resolve the review threads

Resolve EVERY thread from Step 2 that was not already resolved, including
the ones that were skipped. The user's intent is a clean PR — an unresolved
"skip" thread looks identical to a forgotten one.

Use the GraphQL `resolveReviewThread` mutation with each thread's node ID:

```bash
gh api graphql -f query='
  mutation($threadId: ID!) {
    resolveReviewThread(input: {threadId: $threadId}) {
      thread { id isResolved }
    }
  }' -f threadId=THREAD_NODE_ID
```

Before resolving a skipped thread, **leave a reply** explaining the decision
so the reviewer understands why. Reply to the thread with
`gh api repos/{owner}/{repo}/pulls/{pr_number}/comments/{comment_id}/replies`
(REST) using the first comment's `id` in the thread:

```bash
gh api --method POST \
  "repos/{owner}/{repo}/pulls/{pr_number}/comments/{comment_id}/replies" \
  -f body="<short reason, e.g.: 'Skipping — handled by the change in foo.ts:42 from commit abc1234.'>"
```

For applied threads, a brief reply like "Applied in <commit-sha>." is
helpful but optional — the commit reference alone is usually enough.

Issue comments (Step 2, surface 2) don't have a thread-resolve concept.
Reply to them in-line if the user expects an acknowledgment, but otherwise
leave them alone.

## Step 8 — Report

Tell the user:

- PR number and URL.
- Counts: applied, skipped, needs-clarification, already-resolved.
- Commit SHA(s) created and push result.
- Any thread that failed to resolve (with the error).
- Any "needs clarification" items still open for them to answer.
- Anything intentionally deferred to a follow-up PR, so they can file tickets.

## Rules

- Never apply a comment you don't understand — escalate instead.
- Never silently drop a comment. Every comment is either applied, replied to
  with a reason, or flagged to the user.
- Never resolve a thread without either applying the suggestion or leaving a
  reply explaining why it was skipped.
- Never rewrite git history (`--amend`, force-push) to "clean up" after
  review without explicit permission.
- Never commit unrelated changes in the same commit as review fixes.
- Bot-authored comments are not automatically noise — evaluate on merit.
- If `$ARGUMENTS` contains a PR number, URL, or instructions (e.g., "only
  the ones from @alice"), honor it — but still fetch the full comment set
  so the summary in Step 4 is accurate.
