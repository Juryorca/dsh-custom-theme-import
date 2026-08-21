# dsh-custom-theme-import

English | [中文](README.zh.md)

A DSH Web skin manager for mainstream DSH skin package format. It imports, previews,
uses, and manages skins without replacing DSH's native plugin system.

## Features

- Import mainstream DSH skin package format from local paths or GitHub.
- Also import DSH theme plugins without `skin.json` when they are standard web client packages (`dsh.client.platform: "web"` + `lib/client.js`).
- Scan installed skins from the web profile's `node_modules`.
- Preview, use, refresh, and manage skins.
- Skin preview thumbnails when the package ships `skin.json` preview images.
- Host-side persistence with optional managed copies.
- UI language follows DSH automatically (Chinese / English).

## Build

```bash
node build.mjs
node build.mjs --check
```

## Install

From GitHub:

```bash
dsh plugin --profile web add -w github:Juryorca/dsh-custom-theme-import
```

From a local checkout:

```bash
dsh plugin --profile web add -w link:/path/to/dsh-custom-theme-import
```

Restart:

```bash
dsh --profile web
```

Open:

```text
Settings → My Themes
```

## Supported skin format

Mainstream DSH skin package format:

```text
skin-package/
├── package.json
├── cordis.patch.yml
├── skin.json
├── lib/index.js
└── lib/client.js
```

Requirements:

- `package.json` must declare `dsh.bundle`.
- `skin.json` must exist.
- `lib/client.js` must be a DSH ModuleLoader bundle exporting `apply(ctx)`.

## Collection repository

A GitHub repository or local path can contain multiple mainstream skins.
Common layouts are scanned automatically:

```text
repo-root/
├── themes/<skin-id>/...
├── skins/<skin-id>/...
└── packages/*/skins/<skin-id>/...
```

Each `<skin-id>/` is a full skin package (`package.json`, `cordis.patch.yml`,
`skin.json`, `lib/index.js`, `lib/client.js`).

## Storage

- Library file: `~/.dsh/dsh-custom-theme-import/library.json`
- Local path imports reference **in place** by default; you can opt in to copy
  them into `~/.dsh/dsh-custom-theme-import/themes/<id>/` as a managed copy.
- GitHub/remote imports are cloned/downloaded into:
  `~/.dsh/dsh-custom-theme-import/themes/<id>/`
