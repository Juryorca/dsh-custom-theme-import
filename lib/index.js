// dsh-custom-theme-import host half.
// Maintains a small JSON library under ~/.dsh/dsh-custom-theme-import/library.json.
// Each entry can be inline (css/dom) or a path to a .json/.css theme file.
// The browser half reads/writes this library through loopback-only RPC.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

const NS = 'dsh-custom-theme-import'
const DATA_DIR = join(homedir(), '.dsh', NS)
const LIBRARY_FILE = join(DATA_DIR, 'library.json')
const READ_CHANNEL = '/dsh-custom-theme-import-read'
const WRITE_CHANNEL = '/dsh-custom-theme-import-write'

export const inject = ['connection']

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

function resolvePack(pack) {
  const fallback = (extra = {}) => ({
    id: pack && pack.id ? pack.id : '',
    name: pack && typeof pack.name === 'string' && pack.name.trim() ? pack.name : '未命名主题',
    css: pack && typeof pack.css === 'string' ? pack.css : '',
    dom: pack && typeof pack.dom === 'string' ? pack.dom : '',
    ...extra,
  })

  try {
    if (pack && typeof pack.path === 'string' && pack.path !== '') {
      const stat = statSync(pack.path)
      if (stat.isDirectory()) {
        // Theme project directory: theme.json (recommended), theme.css, dom.js.
        const manifestPath = join(pack.path, 'theme.json')
        const cssPath = join(pack.path, 'theme.css')
        const domPath = join(pack.path, 'dom.js')
        if (existsSync(manifestPath)) {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
          const cssFile = typeof manifest.cssFile === 'string' ? resolve(pack.path, manifest.cssFile) : cssPath
          const domFile = typeof manifest.domFile === 'string' ? resolve(pack.path, manifest.domFile) : domPath
          return {
            id: pack.id,
            name: typeof pack.name === 'string' && pack.name.trim() ? pack.name : (typeof manifest.name === 'string' ? manifest.name : basename(pack.path)),
            css: existsSync(cssFile) ? readFileSync(cssFile, 'utf8') : '',
            dom: existsSync(domFile) ? readFileSync(domFile, 'utf8') : '',
          }
        }
        return {
          id: pack.id,
          name: typeof pack.name === 'string' && pack.name.trim() ? pack.name : basename(pack.path),
          css: existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '',
          dom: existsSync(domPath) ? readFileSync(domPath, 'utf8') : '',
        }
      }

      const text = readFileSync(pack.path, 'utf8')
      if (/\.json$/i.test(pack.path)) {
        const parsed = JSON.parse(text)
        const manifest = parsed && parsed.manifest ? parsed.manifest : parsed
        const base = dirname(resolve(pack.path))
        const cssFile = typeof manifest.cssFile === 'string' ? resolve(base, manifest.cssFile) : null
        const domFile = typeof manifest.domFile === 'string' ? resolve(base, manifest.domFile) : null
        return {
          id: pack.id,
          name: typeof pack.name === 'string' && pack.name.trim() ? pack.name : (manifest && typeof manifest.name === 'string' ? manifest.name : basename(pack.path)),
          css: cssFile ? readFileSync(cssFile, 'utf8') : (typeof manifest.css === 'string' ? manifest.css : ''),
          dom: domFile ? readFileSync(domFile, 'utf8') : (typeof manifest.dom === 'string' ? manifest.dom : (typeof pack.dom === 'string' ? pack.dom : '')),
        }
      }

      // Plain .css file.
      const domPath = pack.domPath ? resolve(dirname(resolve(pack.path)), pack.domPath) : null
      return {
        id: pack.id,
        name: typeof pack.name === 'string' && pack.name.trim() ? pack.name : basename(pack.path),
        css: text,
        dom: domPath ? readFileSync(domPath, 'utf8') : (typeof pack.dom === 'string' ? pack.dom : ''),
      }
    }

    if (pack && typeof pack.cssPath === 'string' && pack.cssPath !== '') {
      const css = readFileSync(pack.cssPath, 'utf8')
      const dom = pack.domPath ? readFileSync(pack.domPath, 'utf8') : (typeof pack.dom === 'string' ? pack.dom : '')
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
      library.activeId = typeof payload.activeId === 'string' ? payload.activeId : library.activeId
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
