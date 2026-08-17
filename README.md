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

- Import a `.json` theme pack (`{ css, dom }`) or a plain `.css` file.
- Add a local theme file by absolute path (`.json` / `.css`).
- Manage multiple themes in a library with Apply / Edit / Delete.
- Active theme is persisted on the host and shared across browsers.
- Export the current theme as a `.dsh-theme.json` file.
- Disable the custom theme without uninstalling.
- Ships an Isaac Basement example pack in `examples/`.

## Build

```bash
node build.mjs
node build.mjs --check
```

## Install

```bash
dsh plugin --profile web add -w \
  link:/home/juryorca/dsh/isaac-theme/dsh-custom-theme-import
```

Restart:

```bash
dsh --profile web
```

Open:

```text
设置 → 插件配置 → Web UI 插件 → 自定义主题导入
```

## Use the Isaac Basement example

Isaac theme source: https://github.com/Juryorca/isaac-basement-theme

Import via file picker:

```text
/home/juryorca/dsh/isaac-theme/dsh-custom-theme-import/examples/isaac-basement.dsh-theme.json
```

Or add it by path in the plugin UI:

```text
/home/juryorca/dsh/isaac-theme/dsh-custom-theme-import/examples/isaac-basement.dsh-theme.json
```

Then click **应用** / **Apply**. The theme is stored in the host library and
auto-applies on every launch.

## Theme pack format

```json
{
  "format": "dsh-custom-theme-import",
  "version": 1,
  "manifest": {
    "id": "my-theme",
    "name": "My Theme",
    "colorScheme": "dark",
    "css": "/* full CSS */",
    "dom": "(ctx) => { /* optional DOM setup; may use ctx.effect */ }"
  }
}
```

The `dom` field is optional. It may be a function expression that receives
`ctx`, or a function body that uses `ctx.effect`. If it returns a function,
that function is used as the cleanup disposer.

## Storage

- Library file: `~/.dsh/dsh-custom-theme-import/library.json`
- Entries can be inline (`css` / `dom`) or path-based (`path` pointing to a
  local `.json` / `.css` file).
- The DOM script is executed as JavaScript in your browser; only import packs
  from sources you trust.
