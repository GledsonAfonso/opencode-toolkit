---
name: code-review
description: Review code changes for quality, correctness, and best practices. Trigger when the user asks to review code, check diffs, or get feedback on changes.
---

# Code Review

Review staged and unstaged code changes for quality, correctness, security, performance, readability, style, and test coverage.

## Step 1 — Gather context (parallel)

Run these in parallel:

- `git status` — see what's changed
- `git diff --staged` — staged changes
- `git diff` — unstaged changes
- `git log --oneline -10` — recent commits for style reference

Detect the project type by looking for:
- `package.json` (Node.js/TypeScript)
- `Cargo.toml` (Rust)
- `pyproject.toml`, `setup.py`, `requirements.txt` (Python)
- `go.mod` (Go)
- `Gemfile`, `Rakefile` (Ruby)

## Step 2 — Run automated checks (if available)

Execute linters and tests if the project has them configured. Use these commands based on detected project type:

| Project | Linter/Formatter | Tests |
|---|---|---|
| Node.js/TypeScript | `eslint .`, `prettier --check` | `npm test`, `yarn test` |
| Python | `ruff .`, `mypy .` | `pytest`, `python -m unittest` |
| Rust | `cargo clippy --all-targets`, `cargo fmt --check` | `cargo test` |
| Go | `golangci-lint run`, `go vet ./...` | `go test ./...` |
| Ruby | `rubocop`, `stylecheck` | `rake test`, `rspec` |

Run these commands in parallel where possible. Report results to the user before proceeding with manual analysis. If a command is not found, skip it silently and continue.

## Step 3 — Analyze changes by category

Review the diff for issues in these categories:

### Correctness
- Logic errors, off-by-one mistakes, race conditions
- Null/undefined handling, missing error cases
- Incorrect type assumptions or coercions

### Security
- Injection risks (SQL, command, template)
- Hardcoded secrets, API keys, passwords in code
- Authentication/authorization bypasses
- XSS, CSRF vulnerabilities

### Performance
- N+1 query patterns
- Unnecessary allocations or copies
- Missing indexes on frequently queried fields
- O(n²) loops where O(n log n) or O(n) is possible

### Readability
- Unclear variable/function names
- Functions longer than ~50 lines or doing too many things
- Magic numbers/strings without constants
- Duplicated code across files

### Style / Conventions
- Inconsistent indentation, spacing, or formatting
- Import ordering that differs from the codebase
- Missing/extra semicolons, trailing commas (language-dependent)

### Testing
- New logic without corresponding test coverage
- Changed code without updated tests
- Tests that are brittle or don't cover edge cases

## Step 4 — Classify findings

Assign each finding a severity level:

| Severity | Description | Action |
|---|---|---|
| 🔴 **Critical** | Bugs, security issues, data loss risk | Must fix before merge |
| 🟡 **Warning** | Code smells, performance concerns, edge cases | Should fix before merge |
| 🟢 **Suggestion** | Style improvements, minor refactors | Nice to have |

## Step 5 — Report findings

Present the review results in this format:

```
# Code Review Summary

## 🔴 Critical Issues (X)
### File: path/to/file.ext
- Line N: <issue description> — <concrete suggestion>

## 🟡 Warnings (X)
### File: path/to/file.ext
- Line N: <issue description> — <concrete suggestion>

## 🟢 Suggestions (X)
### File: path/to/file.ext
- Line N: <issue description> — <concrete suggestion>

## Automated Checks
- Linter: <result or "not configured" >
- Tests: <result or "not run" >

## Overall Assessment
<1-2 sentence summary of the code quality and whether it's ready to merge.>
```

Include line numbers for every issue. Provide concrete suggestions — never just say "this is bad." If no issues are found, report that the code looks clean.

## Step 6 — Suggest next steps (no auto-fixes)

- If the user asks, suggest `git commit` with a review-related message.
- Suggest running linter fixes (`eslint --fix`, `ruff --fix`, etc.) — but **never** execute them.
- If the user asks for a deeper dive into a specific file or category, focus the analysis there.

## Notes

- If $ARGUMENTS contains a hint (e.g., /code-review src/auth.ts), use it to focus the review on that file or area.
- If there are no changes to review, say so and stop.
- Never modify files unless explicitly asked.
- If the project uses Context7 MCP, use it to fetch current documentation for the language/framework when determining best practices.
- If no automated checks are configured, still perform manual analysis based on the diff and your knowledge of the tech stack.
