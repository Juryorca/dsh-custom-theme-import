// dsh-custom-theme-import host half.
// Maintains a small JSON library under ~/.dsh/dsh-custom-theme-import/library.json.
// Each entry can be inline (css/dom) or a path to a .json/.css theme file.
// The browser half reads/writes this library through loopback-only RPC.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, cpSync, rmSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

const NS = 'dsh-custom-theme-import'
const DATA_DIR = join(homedir(), '.dsh', NS)
const THEMES_DIR = join(DATA_DIR, 'themes')
const LIBRARY_FILE = join(DATA_DIR, 'library.json')
const READ_CHANNEL = '/dsh-custom-theme-import-read'
const WRITE_CHANNEL = '/dsh-custom-theme-import-write'

export const inject = ['connection']

function expandHome(input) {
  if (typeof input !== 'string' || input === '') return input
  if (input === '~') return homedir()
  if (input.startsWith('~/') || input.startsWith('~\\')) return join(homedir(), input.slice(2))
  return input
}

function defaultLibrary() {
  return { version: 1, revision: 0, activeId: null, packs: [] }
}

function readLibrary() {
  try {
    const parsed = JSON.parse(readFileSync(LIBRARY_FILE, 'utf8'))
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.packs)) {
      return {
        version: typeof parsed.version === 'number' ? parsed.version : 1,
        revision: typeof parsed.revision === 'number' ? parsed.revision : 0,
        activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null,
        packs: parsed.packs,
      }
    }
  } catch {
    // Missing or invalid file: start empty.
  }
  return defaultLibrary()
}

function writeLibrary(library) {
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(LIBRARY_FILE, JSON.stringify(library, null, 2) + '\n')
}

function makeId() {
  return `pack-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function copySourceToManaged(source, id) {
  const src = expandHome(source)
  const target = join(THEMES_DIR, id)
  rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
  const stat = statSync(src)
  if (stat.isDirectory()) {
    cpSync(src, target, { recursive: true })
    return target
  }
  const base = dirname(resolve(src))
  const fileName = basename(src)
  cpSync(src, join(target, fileName))
  // If this is a path-based manifest, also copy its referenced source files.
  if (/\.json$/i.test(fileName)) {
    try {
      const manifest = JSON.parse(readFileSync(src, 'utf8'))
      const refs = [manifest.cssFile, manifest.domFile].filter((ref) => typeof ref === 'string')
      for (const ref of refs) {
        const refPath = resolve(base, ref)
        if (existsSync(refPath)) cpSync(refPath, join(target, basename(refPath)))
      }
    } catch {
      // Not a JSON manifest; ignore.
    }
  }
  return target
}

async function importGithubToManaged(url, id) {
  const target = join(THEMES_DIR, id)
  rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
  const trimmed = url.trim()
  if (/^https?:\/\/(raw\.)?githubusercontent\.com\//i.test(trimmed)) {
    const fileName = basename(new URL(trimmed).pathname) || 'theme.css'
    const response = await fetch(trimmed)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = await response.text()
    writeFileSync(join(target, fileName), text)
    if (/\.json$/i.test(fileName)) {
      try {
        const manifest = JSON.parse(text)
        const baseUrl = new URL(trimmed)
        const path = baseUrl.pathname.split('/')
        path.pop()
        for (const ref of [manifest.cssFile, manifest.domFile]) {
          if (typeof ref !== 'string') continue
          const refUrl = `${baseUrl.origin}${path.join('/')}/${ref}`
          const refRes = await fetch(refUrl)
          if (refRes.ok) writeFileSync(join(target, basename(ref)), await refRes.text())
        }
      } catch {
        // Not a manifest; ignore.
      }
    }
    return target
  }
  execFileSync('git', ['clone', '--depth', '1', trimmed, target], { stdio: 'inherit' })
  return target
}

function validateManagedTheme(target) {
  const stat = statSync(target)
  if (stat.isDirectory()) {
    const manifest = join(target, 'theme.json')
    const css = join(target, 'theme.css')
    if (existsSync(manifest)) {
      try {
        const parsed = JSON.parse(readFileSync(manifest, 'utf8'))
        const m = parsed && parsed.manifest ? parsed.manifest : parsed
        if (typeof m.css !== 'string' && typeof m.cssFile !== 'string') return false
      } catch {
        return false
      }
      return true
    }
    return existsSync(css)
  }
  if (/\.json$/i.test(target)) {
    try {
      const parsed = JSON.parse(readFileSync(target, 'utf8'))
      const m = parsed && parsed.manifest ? parsed.manifest : parsed
      return typeof m.css === 'string' || typeof m.cssFile === 'string'
    } catch {
      return false
    }
  }
  return /\.css$/i.test(target)
}

function collectThemeEntries(target) {
  if (validateManagedTheme(target)) {
    return [{ name: basename(target), path: target }]
  }
  const themesDir = join(target, 'themes')
  if (existsSync(themesDir) && statSync(themesDir).isDirectory()) {
    const entries = []
    for (const entry of readdirSync(themesDir)) {
      const candidate = join(themesDir, entry)
      if (!statSync(candidate).isDirectory()) continue
      if (validateManagedTheme(candidate)) entries.push({ name: entry, path: candidate })
    }
    return entries
  }
  return []
}

function resolvePack(pack) {
  const fallback = (extra = {}) => ({
    id: pack && pack.id ? pack.id : '',
    name: pack && typeof pack.name === 'string' && pack.name.trim() ? pack.name : '未命名主题',
    css: pack && typeof pack.css === 'string' ? pack.css : '',
    dom: pack && typeof pack.dom === 'string' ? pack.dom : '',
    ...extra,
  })

  try {
    const path = expandHome(pack && pack.path)
    if (typeof path === 'string' && path !== '') {
      const stat = statSync(path)
      if (stat.isDirectory()) {
        // Theme project directory: theme.json (recommended), theme.css, dom.js.
        const manifestPath = join(path, 'theme.json')
        const cssPath = join(path, 'theme.css')
        const domPath = join(path, 'dom.js')
        if (existsSync(manifestPath)) {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
          const cssFile = typeof manifest.cssFile === 'string' ? resolve(path, manifest.cssFile) : cssPath
          const domFile = typeof manifest.domFile === 'string' ? resolve(path, manifest.domFile) : domPath
          return {
            id: pack.id,
            name: typeof pack.name === 'string' && pack.name.trim() ? pack.name : (typeof manifest.name === 'string' ? manifest.name : basename(path)),
            css: existsSync(cssFile) ? readFileSync(cssFile, 'utf8') : '',
            dom: existsSync(domFile) ? readFileSync(domFile, 'utf8') : '',
          }
        }
        return {
          id: pack.id,
          name: typeof pack.name === 'string' && pack.name.trim() ? pack.name : basename(path),
          css: existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '',
          dom: existsSync(domPath) ? readFileSync(domPath, 'utf8') : '',
        }
      }

      const text = readFileSync(path, 'utf8')
      if (/\.json$/i.test(path)) {
        const parsed = JSON.parse(text)
        const manifest = parsed && parsed.manifest ? parsed.manifest : parsed
        const base = dirname(resolve(path))
        const cssFile = typeof manifest.cssFile === 'string' ? resolve(base, manifest.cssFile) : null
        const domFile = typeof manifest.domFile === 'string' ? resolve(base, manifest.domFile) : null
        return {
          id: pack.id,
          name: typeof pack.name === 'string' && pack.name.trim() ? pack.name : (manifest && typeof manifest.name === 'string' ? manifest.name : basename(path)),
          css: cssFile ? readFileSync(cssFile, 'utf8') : (typeof manifest.css === 'string' ? manifest.css : ''),
          dom: domFile ? readFileSync(domFile, 'utf8') : (typeof manifest.dom === 'string' ? manifest.dom : (typeof pack.dom === 'string' ? pack.dom : '')),
        }
      }

      // Plain .css file.
      const domPath = pack.domPath ? resolve(dirname(resolve(path)), expandHome(pack.domPath)) : null
      return {
        id: pack.id,
        name: typeof pack.name === 'string' && pack.name.trim() ? pack.name : basename(path),
        css: text,
        dom: domPath ? readFileSync(domPath, 'utf8') : (typeof pack.dom === 'string' ? pack.dom : ''),
      }
    }

    const cssPath = expandHome(pack && pack.cssPath)
    if (typeof cssPath === 'string' && cssPath !== '') {
      const css = readFileSync(cssPath, 'utf8')
      const domPath = expandHome(pack && pack.domPath)
      const dom = domPath ? readFileSync(domPath, 'utf8') : (typeof pack.dom === 'string' ? pack.dom : '')
      return fallback({ css, dom })
    }
  } catch (error) {
    return fallback({
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return fallback()
}

function view() {
  const library = readLibrary()
  return {
    revision: library.revision,
    activeId: library.activeId,
    packs: library.packs,
    resolved: library.packs.map(resolvePack),
  }
}

async function handle(endpoint, payload, write) {
  try {
    if (!write && endpoint === 'get') {
      return { ok: true, value: view() }
    }
    if (write && endpoint === 'save') {
      if (!payload || !Array.isArray(payload.packs) || typeof payload.expectedRevision !== 'number') {
        return { ok: false, error: { code: 'bad-request', message: 'malformed save payload', details: {} } }
      }
      const library = readLibrary()
      if (payload.expectedRevision !== library.revision) {
        return { ok: false, error: { code: 'settings-conflict', message: 'stale library revision', details: { expected: payload.expectedRevision, actual: library.revision } } }
      }
      library.packs = payload.packs
      if (Object.prototype.hasOwnProperty.call(payload, 'activeId')) {
        library.activeId = payload.activeId
      }
      library.revision += 1
      writeLibrary(library)
      return { ok: true, value: view() }
    }
    if (write && endpoint === 'addPath') {
      const source = payload && payload.path
      if (typeof source !== 'string' || source === '') {
        return { ok: false, error: { code: 'bad-request', message: 'path is required', details: {} } }
      }
      const library = readLibrary()
      const sourcePath = expandHome(source)
      const copy = payload.copy === true
      let entries
      if (copy) {
        const id = makeId()
        const target = copySourceToManaged(sourcePath, id)
        entries = collectThemeEntries(target)
      } else {
        entries = collectThemeEntries(sourcePath)
      }
      if (entries.length === 0) {
        return { ok: false, error: { code: 'invalid-theme', message: '无法识别该路径为主题：需要 theme.json / theme.css / 有效 .json/.css 文件，或 themes/ 集合目录', details: {} } }
      }
      for (const entry of entries) {
        library.packs.push({ id: makeId(), name: entry.name, path: entry.path })
      }
      library.revision += 1
      writeLibrary(library)
      return { ok: true, value: view() }
    }
    if (write && endpoint === 'importGithub') {
      const url = payload && payload.url
      if (typeof url !== 'string' || url === '') {
        return { ok: false, error: { code: 'bad-request', message: 'url is required', details: {} } }
      }
      const library = readLibrary()
      const id = makeId()
      const target = await importGithubToManaged(url, id)
      const entries = collectThemeEntries(target)
      if (entries.length === 0) {
        rmSync(target, { recursive: true, force: true })
        return { ok: false, error: { code: 'invalid-theme', message: '无法识别该 GitHub 来源为主题：需要 theme.json / theme.css / 有效 .json/.css 文件，或 themes/ 集合目录', details: {} } }
      }
      for (const entry of entries) {
        library.packs.push({ id: makeId(), name: entry.name, path: entry.path })
      }
      library.revision += 1
      writeLibrary(library)
      return { ok: true, value: view() }
    }
    return { ok: false, error: { code: 'bad-request', message: 'unknown endpoint', details: {} } }
  } catch (error) {
    return { ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error), details: {} } }
  }
}

export function apply(ctx) {
  ctx.inject(['connection'], (connectionCtx) => {
    const connection = connectionCtx.connection
    connection.rpc.handle(READ_CHANNEL, (endpoint, payload) => handle(endpoint, payload, false), { authority: 'loopback' })
    connection.rpc.handle(WRITE_CHANNEL, (endpoint, payload) => handle(endpoint, payload, true), { authority: 'loopback' })
  })
}
