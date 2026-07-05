Do not use abbreviations in code or names unless the user explicitly asks for them.

Use full, descriptive words for everything you name: variables, functions,
methods, classes, types, parameters, files, config keys, and CLI flags. Write
`configuration` not `cfg`, `request` not `req`, `button` not `btn`, `database`
not `db`, `calculate` not `calc`, `message` not `msg`.

## Exceptions (allowed without being asked)

- The user explicitly asks for a shortened or abbreviated name.
- You are matching a name that already exists in the codebase or an external
  API/library -- stay consistent with it rather than renaming.
- The short form is the established, unambiguous standard and the expansion would
  be unusual: `id`, `URL`, `HTTP`, `API`, `JSON`, `HTML`, and `UUID`.

## Notes

- Prefer clarity over brevity; a longer name that reads plainly beats a cryptic
  short one.
- This rule covers names and identifiers in code, not prose in your responses.
