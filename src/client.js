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
  pathPlaceholder: '或填写本地文件路径，如 /home/.../theme.dsh-theme.json',
  library: '我的主题',
  empty: '还没有主题，先添加一个吧。',
  inUse: '使用中',
  notInUse: '未使用',
  use: '使用',
  disable: '禁用',
  export: '导出',
  delete: '删除',
}

const en = {
  title: 'My Themes',
  description: 'Add, switch, and manage custom themes here. Themes are stored on this machine and survive browser changes.',
  add: 'Add theme',
  pathPlaceholder: 'or enter a local file path, e.g. /home/.../theme.dsh-theme.json',
  library: 'My themes',
  empty: 'No themes yet. Add one to begin.',
  inUse: 'In use',
  notInUse: 'Not in use',
  use: 'Use',
  disable: 'Disable',
  export: 'Export',
  delete: 'Delete',
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
    notice: null,
    pathInput: '',
  })
  const fileRef = React.useRef(null)

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
      setState({
        status: 'ready',
        packs: view.packs,
        resolved: view.resolved,
        activeId: view.activeId,
        revision: view.revision,
        notice: message || '已保存',
        pathInput: '',
      })
      setTimeout(() => location.reload(), 700)
    } catch (error) {
      notify(`保存失败：${error.message}`)
    }
  }

  const applyPack = (id) => {
    const pack = state.packs.find((p) => p.id === id)
    persist(state.packs, id, `已切换到：${pack?.name || id}`)
  }

  const disableActive = () => {
    persist(state.packs, null, '已停止使用当前主题')
  }

  const deletePack = (id) => {
    const nextPacks = state.packs.filter((pack) => pack.id !== id)
    const nextActive = state.activeId === id ? null : state.activeId
    persist(nextPacks, nextActive, '已删除')
  }

  const exportPack = (pack) => {
    download(`${pack.name.toLowerCase().replace(/\s+/g, '-')}.dsh-theme.json`, JSON.stringify({
      format: 'dsh-custom-theme-import',
      version: 1,
      manifest: { id: pack.id, name: pack.name, css: pack.css, dom: pack.dom },
    }, null, 2))
    notify(`已导出：${pack.name}`)
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
      persist([...state.packs, pack], pack.id, `已添加并使用：${name}`)
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
    persist([...state.packs, pack], pack.id, `已添加并使用：${pack.name}`)
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
    ? h('p', { key: 'empty' }, '还没有主题，先添加一个吧。')
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
              active ? '使用中' : '未使用',
              raw && raw.path ? ` · ${raw.path}` : '',
            ]),
          ]),
          h('div', { key: 'ops', style: { display: 'flex', gap: '6px', flexShrink: 0 } }, [
            h('button', { key: 'apply', onClick: () => active ? disableActive() : applyPack(pack.id), style: { ...buttonStyle, marginRight: 0 } }, active ? '禁用' : '使用'),
            h('button', { key: 'export', onClick: () => exportPack(pack) }, '导出'),
            h('button', { key: 'delete', onClick: () => deletePack(pack.id) }, '删除'),
          ]),
        ])
      }))

  return h('div', null, [
    h('h3', { key: 'title' }, '我的主题'),
    h('p', { key: 'desc' }, '在这里添加、切换和管理自定义主题。主题保存在本机，换浏览器也不会丢。'),
    noticeBlock,
    h('div', { key: 'add-section', style: { ...rowStyle, border: '1px solid #ddd', borderRadius: '8px', padding: '12px' } }, [
      h('div', { key: 'add-title', style: { fontWeight: 600, marginBottom: '8px' } }, '添加主题'),
      h('div', { key: 'file-row', style: { marginBottom: '8px' } }, [
        h('input', { key: 'file', type: 'file', ref: fileRef, accept: '.json,.css,application/json,text/css', onChange: onImportFile, style: { display: 'none' } }),
        h('button', { key: 'from-file', onClick: () => fileRef.current && fileRef.current.click(), style: buttonStyle }, '选择文件'),
      ]),
      h('div', { key: 'path-row', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
        h('input', {
          key: 'path-input',
          type: 'text',
          value: state.pathInput,
          onChange: (e) => setState((current) => ({ ...current, pathInput: e.target.value })),
          placeholder: '或填写本地文件路径，如 /home/.../theme.dsh-theme.json',
          style: { flex: 1, boxSizing: 'border-box' },
        }),
        h('button', { key: 'add-path', onClick: onAddPath }, '添加'),
      ]),
    ]),
    h('div', { key: 'library', style: rowStyle }, [
      h('label', { key: 'l', style: labelStyle }, '我的主题'),
      packList,
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
