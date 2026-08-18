window.__ModuleLoader__.load({
	id: "dsh-custom-theme-import",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
// dsh-custom-theme-import browser half.
// Plain JavaScript source; build.mjs wraps it in the DSH ModuleLoader bundle.
const React = require('react')

const ID = 'dsh-custom-theme-import'
const NS = 'custom-theme-import'
const STYLE_TAG_ID = `${ID}/theme`
const READ_CHANNEL = '/dsh-custom-theme-import-read'
const WRITE_CHANNEL = '/dsh-custom-theme-import-write'

const zh = {
  title: '我的主题',
  description: '在这里添加、切换和管理自定义主题。主题保存在本机，换浏览器也不会丢。',
  add: '添加主题',
  pathPlaceholder: '填写本地主题文件路径或主题目录',
  githubPlaceholder: '或粘贴 GitHub / raw 链接',
  addPath: '添加',
  importGithub: '导入 GitHub',
  library: '我的主题',
  empty: '还没有主题，先添加一个吧。',
  inUse: '使用中',
  notInUse: '未使用',
  previewing: '预览中',
  use: '使用',
  disable: '禁用',
  preview: '预览',
  export: '导出',
  delete: '删除',
  refresh: '刷新',
  copyLocal: '复制到插件主题库（托管副本）',
  refreshSuccess: '已刷新',
  refreshFailed: '刷新失败：{message}',
  loadFailed: '加载失败：{message}',
  saveSuccess: '已保存',
  saveFailed: '保存失败：{message}',
  used: '已使用：{name}',
  previewOf: '预览中：{name}',
  stopped: '已停止使用当前主题',
  deleted: '已删除',
  deleteFailed: '删除失败：{message}',
  exported: '已导出：{name}',
  pathRequired: '请填写本地主题文件路径',
  addedOne: '已添加到列表：{name}',
  addedCount: '已添加 {count} 个主题到列表',
  addFailed: '添加失败：{message}',
  githubRequired: '请填写 GitHub 链接',
  importedOne: '已添加到列表：{name}',
  importedCount: '已从集合导入 {count} 个主题',
  githubFailed: 'GitHub 导入失败：{message}',
}

const en = {
  title: 'My Themes',
  description: 'Add, switch, and manage custom themes here. Themes are stored on this machine and survive browser changes.',
  add: 'Add theme',
  pathPlaceholder: 'Enter local theme file path or theme directory',
  githubPlaceholder: 'Or paste a GitHub / raw link',
  addPath: 'Add',
  importGithub: 'Import GitHub',
  library: 'My themes',
  empty: 'No themes yet. Add one to begin.',
  inUse: 'In use',
  notInUse: 'Not in use',
  previewing: 'Previewing',
  use: 'Use',
  disable: 'Disable',
  preview: 'Preview',
  export: 'Export',
  delete: 'Delete',
  refresh: 'Refresh',
  copyLocal: 'Copy into the plugin theme library (managed copy)',
  refreshSuccess: 'Refreshed',
  refreshFailed: 'Refresh failed: {message}',
  loadFailed: 'Load failed: {message}',
  saveSuccess: 'Saved',
  saveFailed: 'Save failed: {message}',
  used: 'Now using: {name}',
  previewOf: 'Previewing: {name}',
  stopped: 'Stopped using the current theme',
  deleted: 'Deleted',
  deleteFailed: 'Delete failed: {message}',
  exported: 'Exported: {name}',
  pathRequired: 'Enter a local theme path',
  addedOne: 'Added to library: {name}',
  addedCount: 'Added {count} themes to library',
  addFailed: 'Add failed: {message}',
  githubRequired: 'Enter a GitHub link',
  importedOne: 'Added to library: {name}',
  importedCount: 'Imported {count} themes from collection',
  githubFailed: 'GitHub import failed: {message}',
}

function makeId() {
  return `pack-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function ThemeCard({ api, t }) {
  const fmt = (key, vars = {}) => Object.entries(vars).reduce((text, [k, v]) => text.replace(`{${k}}`, String(v)), t(key))

  const [state, setState] = React.useState({
    status: 'loading',
    packs: [],
    resolved: [],
    activeId: null,
    revision: 0,
    notice: null,
    pathInput: '',
    githubUrl: '',
    copyLocal: false,
    previewId: null,
  })

  const applyCurrent = (view, previewId) => {
    const target = previewId
      ? view.resolved.find((pack) => pack.id === previewId)
      : view.resolved.find((pack) => pack.id === view.activeId) || null
    api.apply(target || null)
  }

  const refresh = (silent = false) => {
    api.load().then((view) => {
      setState((current) => {
        const next = {
          ...current,
          status: 'ready',
          packs: view.packs,
          resolved: view.resolved,
          activeId: view.activeId,
          revision: view.revision,
          notice: silent ? current.notice : t('refreshSuccess'),
        }
        applyCurrent(view, current.previewId)
        return next
      })
    }).catch((error) => {
      if (!silent) setState((current) => ({ ...current, notice: fmt('refreshFailed', { message: error.message }) }))
    })
  }

  React.useEffect(() => {
    let alive = true
    api.load().then((view) => {
      if (!alive) return
      setState({
        status: 'ready',
        packs: view.packs,
        resolved: view.resolved,
        activeId: view.activeId,
        revision: view.revision,
        notice: null,
        pathInput: '',
        githubUrl: '',
        copyLocal: false,
        previewId: null,
      })
      applyCurrent(view, null)
    }).catch((error) => {
      if (!alive) return
      setState((current) => ({ ...current, status: 'error', notice: fmt('loadFailed', { message: error.message }) }))
    })
    return () => { alive = false }
  }, [api])

  const notify = (message) => setState((current) => ({ ...current, notice: message }))

  const persist = async (packs, activeId, message) => {
    try {
      const view = await api.save(packs, state.revision, activeId)
      setState((current) => {
        const next = {
          ...current,
          status: 'ready',
          packs: view.packs,
          resolved: view.resolved,
          activeId: view.activeId,
          revision: view.revision,
          notice: message || t('saveSuccess'),
          previewId: null,
        }
        applyCurrent(view, null)
        return next
      })
    } catch (error) {
      notify(fmt('saveFailed', { message: error.message }))
    }
  }

  const applyPack = (id) => {
    const pack = state.packs.find((p) => p.id === id)
    persist(state.packs, id, fmt('used', { name: pack?.name || id }))
  }

  const previewPack = (id) => {
    const pack = state.resolved.find((p) => p.id === id)
    if (!pack) return
    setState((current) => ({ ...current, previewId: id, notice: fmt('previewOf', { name: pack.name }) }))
    api.apply(pack)
  }

  const disableActive = () => {
    persist(state.packs, null, t('stopped'))
  }

  const deletePack = async (id) => {
    try {
      const view = await api.deletePack(id)
      applyView(view, t('deleted'))
    } catch (error) {
      notify(fmt('deleteFailed', { message: error.message }))
    }
  }

  const exportPack = (pack) => {
    if (pack.bundle) {
      notify('标准皮肤包请使用 GitHub/本地路径导入，暂不支持浏览器导出完整包')
      return
    }
    download(`${pack.name.toLowerCase().replace(/\s+/g, '-')}.dsh-theme.json`, JSON.stringify({
      format: 'dsh-custom-theme-import',
      version: 1,
      manifest: { id: pack.id, name: pack.name, css: pack.css, dom: pack.dom },
    }, null, 2))
    notify(fmt('exported', { name: pack.name }))
  }

  const applyView = (view, message) => {
    setState((current) => {
      const next = {
        ...current,
        status: 'ready',
        packs: view.packs,
        resolved: view.resolved,
        activeId: view.activeId,
        revision: view.revision,
        notice: message || t('saveSuccess'),
        previewId: null,
      }
      applyCurrent(view, null)
      return next
    })
  }

  const onAddPath = async () => {
    const path = state.pathInput.trim()
    if (!path) {
      notify(t('pathRequired'))
      return
    }
    try {
      const view = await api.addPath(path, state.copyLocal)
      const count = view.packs.length - state.packs.length
      const name = view.packs[view.packs.length - 1]?.name || path
      applyView(view, count > 1 ? fmt('addedCount', { count }) : fmt('addedOne', { name }))
    } catch (error) {
      notify(fmt('addFailed', { message: error.message }))
    }
  }

  const onImportGithub = async () => {
    const input = state.githubUrl.trim()
    if (!input) {
      notify(t('githubRequired'))
      return
    }
    try {
      const view = await api.importGithub(input)
      const count = view.packs.length - state.packs.length
      const name = view.packs[view.packs.length - 1]?.name || 'GitHub'
      applyView(view, count > 1 ? fmt('importedCount', { count }) : fmt('importedOne', { name }))
    } catch (error) {
      console.error('dsh-custom-theme-import: github import failed', error)
      notify(fmt('githubFailed', { message: error.message }))
    }
  }

  const h = React.createElement
  const rowStyle = { marginBottom: '10px' }
  const labelStyle = { display: 'block', marginBottom: '4px', fontWeight: 600 }
  const buttonStyle = { marginRight: '8px' }

  const noticeBlock = state.notice
    ? h('div', {
        key: 'notice',
        style: {
          padding: '8px 12px',
          marginBottom: '10px',
          borderRadius: '6px',
          background: '#e8f4fd',
          border: '1px solid #4f83f2',
          color: '#1d4f91',
        },
      }, state.notice)
    : null

  const packList = state.resolved.length === 0
    ? h('p', { key: 'empty' }, t('empty'))
    : h('div', { key: 'list', style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, state.resolved.map((pack) => {
        const active = state.activeId === pack.id
        const previewing = state.previewId === pack.id
        const raw = state.packs.find((candidate) => candidate.id === pack.id)
        const status = active ? t('inUse') : previewing ? t('previewing') : t('notInUse')
        return h('div', {
          key: pack.id,
          style: {
            border: active || previewing ? '2px solid #4f83f2' : '1px solid #ccc',
            borderRadius: '8px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: active || previewing ? 'rgba(79, 131, 242, 0.08)' : 'transparent',
          },
        }, [
          h('div', { key: 'info', style: { minWidth: 0 } }, [
            h('div', { key: 'name', style: { fontWeight: 600 } }, pack.name),
            h('div', { key: 'status', style: { fontSize: '12px', color: active || previewing ? '#4f83f2' : '#888' } }, [
              status,
              raw && raw.path ? ` · ${raw.path}` : '',
            ]),
          ]),
          h('div', { key: 'ops', style: { display: 'flex', gap: '6px', flexShrink: 0 } }, [
            h('button', { key: 'apply', onClick: () => active ? disableActive() : applyPack(pack.id), style: { ...buttonStyle, marginRight: 0 } }, active ? t('disable') : t('use')),
            h('button', { key: 'preview', onClick: () => previewPack(pack.id) }, t('preview')),
            h('button', { key: 'export', onClick: () => exportPack(pack) }, t('export')),
            h('button', { key: 'delete', onClick: () => deletePack(pack.id) }, t('delete')),
          ]),
        ])
      }))

  return h('div', null, [
    h('h3', { key: 'title' }, t('title')),
    h('p', { key: 'desc' }, t('description')),
    noticeBlock,
    h('div', { key: 'toolbar', style: { ...rowStyle } }, [
      h('button', { key: 'refresh', onClick: () => refresh(false), style: buttonStyle }, t('refresh')),
    ]),
    h('div', { key: 'add-section', style: { ...rowStyle, border: '1px solid #ddd', borderRadius: '8px', padding: '12px' } }, [
      h('div', { key: 'add-title', style: { fontWeight: 600, marginBottom: '8px' } }, t('add')),
      h('div', { key: 'path-row', style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } }, [
        h('input', {
          key: 'path-input',
          type: 'text',
          value: state.pathInput,
          onChange: (e) => setState((current) => ({ ...current, pathInput: e.target.value })),
          placeholder: t('pathPlaceholder'),
          style: { flex: 1, boxSizing: 'border-box' },
        }),
        h('button', { key: 'add-path', onClick: onAddPath }, t('addPath')),
      ]),
      h('label', { key: 'copy-local', style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' } }, [
        h('input', { key: 'copy-local-input', type: 'checkbox', checked: state.copyLocal, onChange: (e) => setState((current) => ({ ...current, copyLocal: e.target.checked })) }),
        t('copyLocal'),
      ]),
      h('div', { key: 'github-row', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
        h('input', {
          key: 'github-input',
          type: 'text',
          value: state.githubUrl,
          onChange: (e) => setState((current) => ({ ...current, githubUrl: e.target.value })),
          placeholder: t('githubPlaceholder'),
          style: { flex: 1, boxSizing: 'border-box' },
        }),
        h('button', { key: 'import-github', onClick: onImportGithub }, t('importGithub')),
      ]),
    ]),
    h('div', { key: 'library', style: rowStyle }, [
      h('label', { key: 'l', style: labelStyle }, t('library')),
      packList,
    ]),
  ])
}

function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-custom-theme-import: dictionaries')
  const t = ctx.locale.bind(NS)

  const connection = ctx.get('connection')
  let currentCleanup = null

  const install = (pack) => {
    if (currentCleanup) { currentCleanup(); currentCleanup = null }
    let domCleanup = null

    if (pack && pack.bundle) {
      try {
        let capturedFactory = null
        const originalLoader = window.__ModuleLoader__
        window.__ModuleLoader__ = { load: (handoff) => { capturedFactory = handoff.factory } }
        try {
          ;(0, eval)(pack.bundle)
        } finally {
          window.__ModuleLoader__ = originalLoader
        }
        if (typeof capturedFactory === 'function') {
          const requireShim = (spec) => {
            const modules = globalThis.__DSH_MODULES__
            if (modules && typeof modules.makeRequire === 'function') {
              try {
                return modules.makeRequire(new Set())(spec)
              } catch {
                // fall through to local shims
              }
            }
            if (spec === 'react') return React
            if (spec === 'react/jsx-runtime') return { jsx: React.createElement, jsxs: React.createElement, Fragment: React.Fragment }
            throw new Error(`dsh-custom-theme-import: cannot provide module ${spec}`)
          }
          const mod = capturedFactory(requireShim)
          const applyFn = mod && (typeof mod.apply === 'function' ? mod.apply : mod.default && typeof mod.default.apply === 'function' ? mod.default.apply : null)
          if (typeof applyFn === 'function') {
            const result = applyFn(ctx)
            if (typeof result === 'function') domCleanup = result
          }
        }
      } catch (error) {
        console.error('dsh-custom-theme-import: standard bundle apply failed', error)
      }
      currentCleanup = () => { if (domCleanup) domCleanup() }
      return
    }

    const style = document.createElement('style')
    style.dataset.plugin = ID
    style.dataset.pluginCss = STYLE_TAG_ID

    if (pack && pack.css) {
      style.textContent = pack.css
      document.head.appendChild(style)
    }

    if (pack && pack.dom) {
      try {
        let factory
        try {
          factory = new Function('ctx', `return (${pack.dom})(ctx)`)
        } catch {
          factory = new Function('ctx', pack.dom)
        }
        const result = factory(ctx)
        if (typeof result === 'function') domCleanup = result
      } catch (error) {
        console.error('dsh-custom-theme-import: DOM apply failed', error)
      }
    }

    currentCleanup = () => {
      style.remove()
      if (domCleanup) domCleanup()
    }
  }

  const api = {
    async load() {
      const response = await connection.rpc.call(READ_CHANNEL, 'get', {})
      if (!response.ok) throw new Error(response.error.message)
      return response.value
    },
    async save(packs, expectedRevision, activeId) {
      const response = await connection.rpc.call(WRITE_CHANNEL, 'save', { packs, expectedRevision, activeId })
      if (!response.ok) throw new Error(response.error.message)
      return response.value
    },
    async addPath(path, copy = false) {
      const response = await connection.rpc.call(WRITE_CHANNEL, 'addPath', { path, copy })
      if (!response.ok) throw new Error(response.error.message)
      return response.value
    },
    async importGithub(url) {
      const response = await connection.rpc.call(WRITE_CHANNEL, 'importGithub', { url })
      if (!response.ok) throw new Error(response.error.message)
      return response.value
    },
    async deletePack(id) {
      const response = await connection.rpc.call(WRITE_CHANNEL, 'deletePack', { id })
      if (!response.ok) throw new Error(response.error.message)
      return response.value
    },
    apply(pack) {
      install(pack)
    },
  }

  ctx.slots.inject('settings.section', () => ctx.slots.register(
    { name: 'settings.section', id: 'custom-theme-import', order: 200, label: () => t('title'), locale: NS, inject: () => ({ api, t }) },
    ThemeCard,
  ))

  ctx.effect(() => {
    api.load().then((view) => {
      const active = view.resolved.find((pack) => pack.id === view.activeId) || null
      install(active)
    }).catch((error) => {
      console.error('dsh-custom-theme-import: load failed', error)
    })
    return () => {
      if (currentCleanup) currentCleanup()
      currentCleanup = null
    }
  }, 'dsh-custom-theme-import: apply')
}

const inject = ['slots', 'locale', 'connection']

module.exports = { apply, inject }

		return module.exports;
	}
});
