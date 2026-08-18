# dsh-custom-theme-import

[English](README.md) | 中文

一个用于管理标准 DSH 皮肤包的插件。支持导入、预览、使用和管理皮肤，不替代 DSH 原生插件系统。

## 功能

- 从本地路径或 GitHub 导入标准 DSH 皮肤包。
- 预览、使用、刷新、管理皮肤。
- 宿主持久化，可选择保存托管副本。
- 界面语言自动跟随 DSH（中文 / English）。

## 构建

```bash
node build.mjs
node build.mjs --check
```

## 安装

通过 GitHub 安装：

```bash
dsh plugin --profile web add -w github:Juryorca/dsh-custom-theme-import
```

通过本地目录安装：

```bash
dsh plugin --profile web add -w link:/本地路径/dsh-custom-theme-import
```

重启：

```bash
dsh --profile web
```

打开：

```text
设置 → 我的主题
```

## 支持的皮肤格式

标准 DSH 皮肤包：

```text
skin-package/
├── package.json
├── cordis.patch.yml
├── skin.json
├── lib/index.js
└── lib/client.js
```

要求：

- `package.json` 必须声明 `dsh.bundle`。
- 必须有 `skin.json`。
- `lib/client.js` 必须是导出 `apply(ctx)` 的 DSH ModuleLoader bundle。

## 集合仓库

GitHub 仓库可以包含多个标准皮肤：

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

## 存储

- 主题库文件：`~/.dsh/dsh-custom-theme-import/library.json`
- 本地路径导入默认引用原路径；也可以选择复制到：
  `~/.dsh/dsh-custom-theme-import/themes/<id>/`
- GitHub/远程导入会克隆/下载到：
  `~/.dsh/dsh-custom-theme-import/themes/<id>/`
