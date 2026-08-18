# dsh-custom-theme-import

[English](README.md) | 中文

一个用于导入、管理、预览和应用自定义主题的 DSH Web 插件。主题库保存在本机：

```text
~/.dsh/dsh-custom-theme-import/library.json
```

主题以轻量源码文件保存（`theme.json` + `theme.css` + 可选 `dom.js`），作者可以直接编辑文件并刷新，无需重新构建或重装。

## 功能

- 通过本地路径导入主题。
- 支持导入 GitHub 仓库或 raw 文件；支持主题集合仓库。
- 添加主题时不会自动切换当前主题。
- 支持预览主题，不必先提交为当前主题。
- 支持使用 / 禁用 / 刷新 / 导出 / 删除主题。
- 宿主持久化：换浏览器、清浏览器数据也不会丢。
- 远程导入会保存托管副本；本地导入默认引用原路径，也可选择复制到插件主题库。
- 界面语言自动跟随 DSH（中文 / English）。

## 构建

```bash
node build.mjs
node build.mjs --check
```

## 安装

通过 GitHub 安装（推荐）：

```bash
dsh plugin --profile web add -w github:Juryorca/dsh-custom-theme-import
```

或通过本地目录安装：

```bash
dsh plugin --profile web add -w \
  link:/本地路径/dsh-custom-theme-import
```

重启：

```bash
dsh --profile web
```

打开：

```text
设置 → 我的主题
```

## 主题格式

### 单主题项目

一个主题是一个目录：

```text
my-theme/
├── theme.json
├── theme.css
└── dom.js          # 可选
```

`theme.json`：

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "cssFile": "theme.css",
  "domFile": "dom.js"
}
```

规则：

- `theme.json` 必须包含 `css` 或 `cssFile`。
- 除非 `css` 已内嵌在 `theme.json`，否则必须有 `theme.css`。
- `dom.js` 可选。可以是函数表达式 `(ctx) => { ... }`，也可以是使用 `ctx.effect` 的函数体；如果返回函数，该函数会被用作清理函数。

### 内嵌包（用于分发）

```json
{
  "format": "dsh-custom-theme-import",
  "version": 1,
  "manifest": {
    "id": "my-theme",
    "name": "My Theme",
    "css": "/* 完整 CSS */",
    "dom": "(ctx) => { /* 可选 DOM 逻辑 */ }"
  }
}
```

### 集合仓库

GitHub 仓库或本地目录可以包含多个主题：

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

规则：

- 如果根目录本身不是单个主题，则必须包含 `themes/` 目录。
- 每个主题目录必须包含 `theme.json`（含 `css`/`cssFile`）或 `theme.css`。
- 导入集合时，每个有效主题会作为独立条目加入主题库。
- 只有至少存在一个有效主题时才会跳过无效条目；如果全部无效，则拒绝导入。

## 示例集合

```text
https://github.com/Juryorca/dsh-themes
```

结构：

```text
dsh-themes/
└── themes/
    └── isaac-basement/
        ├── theme.json
        ├── theme.css
        └── dom.js
```

## 存储

- 主题库文件：`~/.dsh/dsh-custom-theme-import/library.json`
- 本地路径导入默认引用原路径；也可以选择复制到：
  `~/.dsh/dsh-custom-theme-import/themes/<id>/`
- GitHub/远程导入会克隆/下载到：
  `~/.dsh/dsh-custom-theme-import/themes/<id>/`
- DOM 脚本会在你的浏览器中执行；请只导入可信来源的主题包。
