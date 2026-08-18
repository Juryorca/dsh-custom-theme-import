# dsh-custom-theme-import

English | [中文](README.zh.md)

A DSH Web plugin for importing, managing, previewing, and applying custom
themes. It keeps a theme library on the host machine at:

```text
~/.dsh/dsh-custom-theme-import/library.json
```

Themes are stored as lightweight source files (`theme.json` + `theme.css` +
optional `dom.js`), so authors can edit them directly and refresh without
rebuilding or reinstalling.

## Features

- Import local paths and GitHub theme collections.
- Preview, use, refresh, and manage themes.
- Host-side persistence with optional managed copies.
- UI language follows DSH automatically (Chinese / English).

## Build

```bash
node build.mjs
node build.mjs --check
```

## Install

From GitHub (recommended):

```bash
dsh plugin --profile web add -w github:Juryorca/dsh-custom-theme-import
```

Or from a local checkout:

```bash
dsh plugin --profile web add -w \
  link:/path/to/dsh-custom-theme-import
```

Restart:

```bash
dsh --profile web
```

Open:

```text
Settings → My Themes
```

## Theme format

### Single theme project

A theme is a directory containing:

```text
my-theme/
├── theme.json
├── theme.css
└── dom.js          # optional
```

`theme.json`:

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "cssFile": "theme.css",
  "domFile": "dom.js"
}
```

Rules:

- `theme.json` must contain `css` or `cssFile`.
- `theme.css` is required unless `css` is embedded in `theme.json`.
- `dom.js` is optional. It may be a function expression `(ctx) => { ... }` or a
  function body that uses `ctx.effect`. If it returns a function, that
  function is used as the cleanup disposer.

### Inline pack (for distribution)

```json
{
  "format": "dsh-custom-theme-import",
  "version": 1,
  "manifest": {
    "id": "my-theme",
    "name": "My Theme",
    "css": "/* full CSS */",
    "dom": "(ctx) => { /* optional DOM setup */ }"
  }
}
```

### Collection repository

A GitHub repository or local directory can contain multiple themes:

```text
repo-root/
├── README.md
└── themes/
    ├── theme-a/
    │   ├── theme.json
    │   ├── theme.css
    │   └── dom.js
    └── theme-b/
        ├── theme.json
        ├── theme.css
        └── dom.js
```

Rules:

- If the root is not itself a single theme, it must contain a `themes/` directory.
- Each theme directory must contain `theme.json` (with `css`/`cssFile`) or `theme.css`.
- Importing a collection adds every valid theme as a separate entry.
- Invalid entries are skipped only if at least one valid theme exists; if none
  are valid, the whole import is rejected.

## Example collection

```text
https://github.com/Juryorca/dsh-themes
```

Structure:

```text
dsh-themes/
└── themes/
    └── isaac-basement/
        ├── theme.json
        ├── theme.css
        └── dom.js
```

## Storage

- Library file: `~/.dsh/dsh-custom-theme-import/library.json`
- Local path imports reference **in place** by default; you can opt in to copy
  them into `~/.dsh/dsh-custom-theme-import/themes/<id>/` as a managed copy.
- GitHub/remote imports are cloned/downloaded into:
  `~/.dsh/dsh-custom-theme-import/themes/<id>/`
- The DOM script is executed as JavaScript in your browser; only import packs
  from sources you trust.
