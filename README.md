# dsh-custom-theme-import

A self-contained DSH Web plugin that lets you import, manage, and apply custom
theme packs containing **CSS + optional DOM script**. The theme library is
stored on the host machine at:

```text
~/.dsh/dsh-custom-theme-import/library.json
```

It does not depend on `dsh-skins`, and it survives browser changes, browser
data clears, and official plugin updates.

## Features

- Add a local theme by path:
  - a `.dsh-theme.json` / `.json` inline pack
  - a `.css` file
  - a path-based theme project directory (`theme.json` + `theme.css` + `dom.js`)
- Manage multiple themes in a library with Use / Disable / Export / Delete.
- Active theme is persisted on the host and shared across browsers.
- Export a theme as a `.dsh-theme.json` file.
- Disable the custom theme without uninstalling.
- Ships an Isaac Basement theme example in `examples/`.

## Build

```bash
node build.mjs
node build.mjs --check
```

## Install

```bash
dsh plugin --profile web add -w \
  link:/absolute/path/to/dsh-custom-theme-import
```

Restart:

```bash
dsh --profile web
```

Open:

```text
设置 → 插件配置 → Web UI 插件 → 自定义主题导入
```

## Use the Isaac Basement theme

Isaac theme source: https://github.com/Juryorca/isaac-basement-theme

Recommended (path-based development layout): clone the theme repo, then in the
plugin UI add the theme project directory by path:

```text
/path/to/isaac-basement-theme
```

or add its manifest:

```text
/path/to/isaac-basement-theme/theme.json
```

The plugin reads `theme.css` and `dom.js` from disk, so you can edit the theme
sources directly without regenerating an embedded JSON pack.

## Theme pack format

### Inline pack (embedded)

```json
{
  "format": "dsh-custom-theme-import",
  "version": 1,
  "manifest": {
    "id": "my-theme",
    "name": "My Theme",
    "css": "/* full CSS */",
    "dom": "(ctx) => { /* optional DOM setup; may use ctx.effect */ }"
  }
}
```

The `dom` field is optional. It may be a function expression that receives
`ctx`, or a function body that uses `ctx.effect`. If it returns a function,
that function is used as the cleanup disposer.

### Path-based theme project (recommended for development)

Instead of embedding CSS/DOM, a manifest can reference files on disk:

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "cssFile": "theme.css",
  "domFile": "dom.js"
}
```

- The path can point to this `theme.json` directly, or to a directory
  containing `theme.json` / `theme.css` / `dom.js`.
- `cssFile` and `domFile` are resolved relative to the manifest/directory.
- Editing source files takes effect after the plugin reloads; no need to keep
  a huge generated JSON in sync.

## Storage

- Library file: `~/.dsh/dsh-custom-theme-import/library.json`
- Entries can be inline (`css` / `dom`) or path-based (`path` pointing to a
  local `.json` / `.css` file).
- The DOM script is executed as JavaScript in your browser; only import packs
  from sources you trust.
