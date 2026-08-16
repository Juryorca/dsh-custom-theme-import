// dsh-custom-theme-import browser half.
// Plain JavaScript source; build.mjs wraps it in the DSH ModuleLoader bundle.
const React = require('react')

const ID = 'dsh-custom-theme-import'
const NS = 'custom-theme-import'
const STYLE_TAG_ID = `${ID}/theme`
const READ_CHANNEL = '/dsh-custom-theme-import-read'
const WRITE_CHANNEL = '/dsh-custom-theme-import-write'
const DEFAULT_VALUE = Object.freeze({ id: '', name: '', css: '', dom: '', path: '' })

const zh = {
  title: '自定义主题导入',
  description: '主题库保存在本机 ~/.dsh/dsh-custom-theme-import/library.json，换浏览器也在。',
  library: '主题库',
  empty: '当前没有主题包，请先导入。',
  active: '当前激活',
  clickApply: '点击「应用」可切换到此主题',
  import: '导入主题',
  addPath: '添加本地路径主题',
  export: '导出当前主题',
  disable: '停用当前主题',
  apply: '应用',
  edit: '编辑',
  delete: '删除',
  save: '保存修改',
  name: '主题名称',
  css: 'CSS',
  dom: 'DOM 脚本（可选）',
  path: '本地主题文件路径（.json / .css）',
  domPlaceholder: '// 示例：(ctx) => { ... return cleanup } 或直接写使用 ctx.effect 的函数体',
}

const en = {
  title: 'Custom Theme Import',
  description: 'Theme library is stored on this machine at ~/.dsh/dsh-custom-theme-import/library.json and shared across browsers.',
  library: 'Theme library',
  empty: 'No theme packs yet. Import one to begin.',
  active: 'Active',
  clickApply: 'Click Apply to use this theme',
  import: 'Import theme',
  addPath: 'Add local path theme',
  export: 'Export current theme',
  disable: 'Disable current theme',
  apply: 'Apply',
  edit: 'Edit',
  delete: 'Delete',
  save: 'Save changes',
  name: 'Theme name',
  css: 'CSS',
  dom: 'DOM script (optional)',
  path: 'Local theme file path (.json / .css)',
  domPlaceholder: '// Example: (ctx) => { ... return cleanup } or a function body using ctx.effect',
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

function ThemeCard({ api }) {
  const [state, setState] = React.useState({
    status: 'loading',
    packs: [],
    resolved: [],
    activeId: null,
    revision: 0,
    editingId: null,
    draft: { ...DEFAULT_VALUE },
    notice: null,
    pathInput: '',
  })
  const fileRef = React.useRef(null)

  React.useEffect(() => {
    let alive = true
    api.load().then((view) => {
      if (!alive) return
      const editingId = view.activeId || (view.packs[0] && view.packs[0].id) || null
      const editing = view.resolved.find((pack) => pack.id === editingId)
      setState({
        status: 'ready',
        packs: view.packs,
        resolved: view.resolved,
        activeId: view.activeId,
        revision: view.revision,
        editingId,
        draft: editing ? { ...editing } : { ...DEFAULT_VALUE },
        notice: null,
        pathInput: '',
      })
    }).catch((error) => {
      if (!alive) return
      setState((current) => ({ ...current, status: 'error', notice: `加载失败：${error.message}` }))
    })
    return () => { alive = false }
  }, [api])

  const notify = (message) => setState((current) => ({ ...current, notice: message }))

  const persist = async (packs, activeId, message) => {
    try {
      const view = await api.save(packs, state.revision, activeId)
      setState((current) => {
        const editingId = activeId || (view.packs[0] && view.packs[0].id) || null
        const editing = view.resolved.find((pack) => pack.id === editingId)
        return {
          ...current,
          status: 'ready',
          packs: view.packs,
          resolved: view.resolved,
          activeId: view.activeId,
          revision: view.revision,
          editingId,
          draft: editing ? { ...editing } : { ...DEFAULT_VALUE },
          notice: message || '已保存',
        }
      })
      setTimeout(() => location.reload(), 700)
    } catch (error) {
      notify(`保存失败：${error.message}`)
    }
  }

  const updateDraft = (patch) => {
    setState((current) => ({ ...current, draft: { ...current.draft, ...patch } }))
  }

  const selectPack = (id) => {
    const pack = state.resolved.find((candidate) => candidate.id === id)
    setState((current) => ({
      ...current,
      editingId: id,
      draft: pack ? { ...pack } : { ...DEFAULT_VALUE },
      notice: null,
    }))
  }

  const saveDraft = () => {
    if (!state.draft.name.trim()) {
      notify('请先填写主题名称')
      return
    }
    const existing = state.packs.some((pack) => pack.id === state.draft.id)
    const nextPacks = existing
      ? state.packs.map((pack) => pack.id === state.draft.id ? { ...state.draft } : pack)
      : [...state.packs, { ...state.draft, id: state.draft.id || makeId() }]
    persist(nextPacks, state.activeId, `已保存：${state.draft.name}`)
  }

  const applyPack = (id) => {
    const pack = state.packs.find((p) => p.id === id)
    persist(state.packs, id, `已切换到：${pack?.name || id}`)
  }

  const deletePack = (id) => {
    const nextPacks = state.packs.filter((pack) => pack.id !== id)
    const nextActive = state.activeId === id ? null : state.activeId
    persist(nextPacks, nextActive, '已删除')
  }

  const onImportFile = async (event) => {
    const file = event.target.files && event.target.files[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      let name = file.name.replace(/\.(json|css)$/i, '') || '导入的主题'
      let css = ''
      let dom = ''
      if (/\.json$/i.test(file.name)) {
        const parsed = JSON.parse(text)
        const manifest = parsed && parsed.manifest ? parsed.manifest : parsed
        name = (manifest && typeof manifest.name === 'string' && manifest.name.trim()) ? manifest.name : name
        css = typeof manifest.css === 'string' ? manifest.css : ''
        dom = typeof manifest.dom === 'string' ? manifest.dom : ''
      } else {
        css = text
      }
      const pack = { id: makeId(), name, css, dom }
      persist([...state.packs, pack], pack.id, `已导入并应用：${name}`)
    } catch (error) {
      console.error('dsh-custom-theme-import: import failed', error)
      notify('导入失败，请检查文件格式')
    }
  }

  const onAddPath = () => {
    const path = state.pathInput.trim()
    if (!path) {
      notify('请填写本地主题文件路径')
      return
    }
    const pack = { id: makeId(), name: path.split(/[\\/]/).pop() || '本地主题', path }
    persist([...state.packs, pack], pack.id, `已添加并应用：${pack.name}`)
  }

  const onExportActive = () => {
    const active = state.resolved.find((pack) => pack.id === state.activeId)
    if (!active) {
      notify('当前没有激活的主题')
      return
    }
    download(`${active.name.toLowerCase().replace(/\s+/g, '-')}.dsh-theme.json`, JSON.stringify({
      format: 'dsh-custom-theme-import',
      version: 1,
      manifest: { id: active.id, name: active.name, css: active.css, dom: active.dom },
    }, null, 2))
    notify('已导出主题包')
  }

  const onDisable = () => {
    persist(state.packs, null, '已停用当前主题')
  }

  const h = React.createElement
  const rowStyle = { marginBottom: '10px' }
  const labelStyle = { display: 'block', marginBottom: '4px', fontWeight: 600 }
  const textareaStyle = { width: '100%', minHeight: '80px', boxSizing: 'border-box', fontFamily: 'monospace' }
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
    ? h('p', { key: 'empty' }, '当前没有主题包，请先导入。')
    : h('div', { key: 'list', style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, state.resolved.map((pack) => {
        const active = state.activeId === pack.id
        const raw = state.packs.find((candidate) => candidate.id === pack.id)
        return h('div', {
          key: pack.id,
          style: {
            border: active ? '2px solid #4f83f2' : '1px solid #ccc',
            borderRadius: '8px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: active ? 'rgba(79, 131, 242, 0.08)' : 'transparent',
          },
        }, [
          h('div', { key: 'info', style: { minWidth: 0 } }, [
            h('div', { key: 'name', style: { fontWeight: 600 } }, pack.name),
            h('div', { key: 'status', style: { fontSize: '12px', color: active ? '#4f83f2' : '#888' } }, [
              active ? '当前激活' : '点击「应用」可切换到此主题',
              raw && raw.path ? ` · ${raw.path}` : '',
            ]),
          ]),
          h('div', { key: 'ops', style: { display: 'flex', gap: '6px', flexShrink: 0 } }, [
            h('button', { key: 'apply', onClick: () => applyPack(pack.id), style: { ...buttonStyle, marginRight: 0 } }, '应用'),
            h('button', { key: 'edit', onClick: () => selectPack(pack.id) }, '编辑'),
            h('button', { key: 'delete', onClick: () => deletePack(pack.id) }, '删除'),
          ]),
        ])
      }))

  return h('div', null, [
    h('h3', { key: 'title' }, '自定义主题导入'),
    h('p', { key: 'desc' }, '主题库保存在本机 ~/.dsh/dsh-custom-theme-import/library.json，换浏览器也在。'),
    noticeBlock,
    h('div', { key: 'actions', style: rowStyle }, [
      h('input', { key: 'file', type: 'file', ref: fileRef, accept: '.json,.css,application/json,text/css', onChange: onImportFile, style: { display: 'none' } }),
      h('button', { key: 'import', onClick: () => fileRef.current && fileRef.current.click(), style: buttonStyle }, '导入主题'),
      h('button', { key: 'export', onClick: onExportActive, style: buttonStyle }, '导出当前主题'),
      h('button', { key: 'disable', onClick: onDisable }, '停用当前主题'),
    ]),
    h('div', { key: 'path-row', style: rowStyle }, [
      h('input', {
        key: 'path-input',
        type: 'text',
        value: state.pathInput,
        onChange: (e) => setState((current) => ({ ...current, pathInput: e.target.value })),
        placeholder: '/home/juryorca/dsh/isaac-theme/dsh-custom-theme-import/examples/isaac-basement.dsh-theme.json',
        style: { width: '70%', boxSizing: 'border-box', marginRight: '8px' },
      }),
      h('button', { key: 'add-path', onClick: onAddPath }, '添加本地路径主题'),
    ]),
    h('div', { key: 'library', style: rowStyle }, [
      h('label', { key: 'l', style: labelStyle }, '主题库'),
      packList,
    ]),
    h('div', { key: 'editor', style: rowStyle }, [
      h('label', { key: 'name-l', style: labelStyle }, '主题名称'),
      h('input', { key: 'name-i', value: state.draft.name, onChange: (e) => updateDraft({ name: e.target.value }), style: { width: '100%', boxSizing: 'border-box' } }),
      h('label', { key: 'css-l', style: { ...labelStyle, marginTop: '8px' } }, 'CSS'),
      h('textarea', { key: 'css-t', value: state.draft.css, onChange: (e) => updateDraft({ css: e.target.value }), style: textareaStyle, spellCheck: false }),
      h('label', { key: 'dom-l', style: { ...labelStyle, marginTop: '8px' } }, 'DOM 脚本（可选）'),
      h('textarea', { key: 'dom-t', value: state.draft.dom, onChange: (e) => updateDraft({ dom: e.target.value }), style: textareaStyle, spellCheck: false, placeholder: '// 示例：(ctx) => { ... return cleanup } 或直接写使用 ctx.effect 的函数体' }),
      h('div', { key: 'save-row', style: { marginTop: '8px' } }, [
        h('button', { key: 'save', onClick: saveDraft }, '保存修改'),
      ]),
    ]),
  ])
}

function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-custom-theme-import: dictionaries')

  const connection = ctx.get('connection')
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
  }

  ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register(
    { name: 'web-ui.plugin.item', id: 'custom-theme-import', order: 130, locale: NS, inject: () => ({ api }) },
    ThemeCard,
  ))

  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = ID
    style.dataset.pluginCss = STYLE_TAG_ID
    let domCleanup = null

    const applyActive = async () => {
      try {
        const view = await api.load()
        const active = view.resolved.find((pack) => pack.id === view.activeId) || null
        style.textContent = active && active.css ? active.css : ''
        if (style.textContent && !style.isConnected) document.head.appendChild(style)
        if (!style.textContent && style.isConnected) style.remove()
        if (domCleanup) { domCleanup(); domCleanup = null }
        if (active && active.dom) {
          try {
            let factory
            try {
              factory = new Function('ctx', `return (${active.dom})(ctx)`)
            } catch {
              factory = new Function('ctx', active.dom)
            }
            const result = factory(ctx)
            if (typeof result === 'function') domCleanup = result
          } catch (error) {
            console.error('dsh-custom-theme-import: DOM apply failed', error)
          }
        }
      } catch (error) {
        console.error('dsh-custom-theme-import: load failed', error)
      }
    }

    void applyActive()
    return () => {
      style.remove()
      if (domCleanup) domCleanup()
    }
  }, 'dsh-custom-theme-import: apply')
}

const inject = ['slots', 'locale', 'connection']

module.exports = { apply, inject }
