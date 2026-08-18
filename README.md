# dsh-custom-theme-import

English | [中文](README.zh.md)

A DSH Web skin manager for standard DSH skin packages. It imports, previews,
uses, and manages skins without replacing DSH's native plugin system.

## Features

- Import standard DSH skin packages from local paths or GitHub.
- Preview, use, refresh, and manage skins.
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

Standard DSH skin package:

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

A GitHub repository can contain multiple standard skins:

```text
repo-root/
└── themes/
    └── <skin-id>/
        ├── package.json
        ├── cordis.patch.yml
        ├── skin.json
        ├── lib/index.js
        └── lib/client.js
```

## Storage

- Library file: `~/.dsh/dsh-custom-theme-import/library.json`
- Local path imports reference **in place** by default; you can opt in to copy
  them into `~/.dsh/dsh-custom-theme-import/themes/<id>/` as a managed copy.
- GitHub/remote imports are cloned/downloaded into:
  `~/.dsh/dsh-custom-theme-import/themes/<id>/`
