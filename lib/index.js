// dsh-custom-theme-import host half.
// Maintains a small JSON library under ~/.dsh/dsh-custom-theme-import/library.json.
// Each entry can be inline (css/dom) or a path to a .json/.css theme file.
// The browser half reads/writes this library through loopback-only RPC.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

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
  if (pack && typeof pack.path === 'string' && pack.path !== '') {
    try {
      const text = readFileSync(pack.path, 'utf8')
      if (/\.json$/i.test(pack.path)) {
        const parsed = JSON.parse(text)
        const manifest = parsed && parsed.manifest ? parsed.manifest : parsed
        return {
          id: pack.id,
          name: typeof pack.name === 'string' && pack.name.trim() ? pack.name : (manifest && typeof manifest.name === 'string' ? manifest.name : basename(pack.path)),
          css: typeof manifest.css === 'string' ? manifest.css : '',
          dom: typeof manifest.dom === 'string' ? manifest.dom : (typeof pack.dom === 'string' ? pack.dom : ''),
        }
      }
      return {
        id: pack.id,
        name: typeof pack.name === 'string' && pack.name.trim() ? pack.name : basename(pack.path),
        css: text,
        dom: typeof pack.dom === 'string' ? pack.dom : '',
      }
    } catch (error) {
      return {
        id: pack.id,
        name: typeof pack.name === 'string' && pack.name.trim() ? pack.name : basename(pack.path),
        css: '',
        dom: '',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
  return {
    id: pack && pack.id ? pack.id : '',
    name: pack && typeof pack.name === 'string' && pack.name.trim() ? pack.name : '未命名主题',
    css: pack && typeof pack.css === 'string' ? pack.css : '',
    dom: pack && typeof pack.dom === 'string' ? pack.dom : '',
  }
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
  const connection = ctx.connection
  connection.rpc.handle(READ_CHANNEL, (endpoint, payload) => handle(endpoint, payload, false), { authority: 'loopback' })
  connection.rpc.handle(WRITE_CHANNEL, (endpoint, payload) => handle(endpoint, payload, true), { authority: 'loopback' })
}
