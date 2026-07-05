Do not add comments to code unless the user explicitly asks for them.

This applies to all code you write or edit: inline comments, block comments, and
docstrings added purely to narrate what the code does. Prefer self-documenting
code -- clear names and structure -- over explanatory comments.

## Exceptions (allowed without being asked)

- The user explicitly requests comments, documentation, or docstrings.
- The comment is required by the language, framework, or tooling to function --
  e.g. `// eslint-disable-next-line`, `# type: ignore`, `# noqa`,
  `@ts-expect-error`, pragmas, or a license/copyright header the repo requires.
- You are preserving comments that already exist. Do not strip existing comments
  unless they have become incorrect.

## Notes

- If a file already has no comments, add none.
- Never add comments that restate the code (`// increment i`) or narrate your
  edits (`// added validation here`).
