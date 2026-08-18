// dsh-custom-theme-import host half.
// Maintains a small JSON library under ~/.dsh/dsh-custom-theme-import/library.json.
// Entries are mainstream DSH skin packages (skin.json + lib/client.js).
// The browser half reads/writes this library through loopback-only RPC.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, cpSync, rmSync, readdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'

const NS = 'dsh-custom-theme-import'
const DATA_DIR = join(homedir(), '.dsh', NS)
const THEMES_DIR = join(DATA_DIR, 'themes')
const LIBRARY_FILE = join(DATA_DIR, 'library.json')
const READ_CHANNEL = '/dsh-custom-theme-import-read'
const WRITE_CHANNEL = '/dsh-custom-theme-import-write'

const importJobs = new Map()

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
  if (!stat.isDirectory()) throw new Error('仅支持目录形式的 DSH 皮肤包')
  cpSync(src, target, { recursive: true })
  return target
}

function startGithubImport(url) {
  const jobId = makeId()
  const target = join(THEMES_DIR, jobId)
  rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
  const job = { id: jobId, url, target, status: 'running', message: '准备导入', progress: 0 }
  importJobs.set(jobId, job)

  const finish = () => {
    try {
      const entries = materializeManagedEntries(target)
      if (entries.length === 0) throw new Error('无法识别该 GitHub 来源为皮肤：需要包含 skin.json 和 lib/client.js 的 DSH 皮肤包，或 skins/themes/packages 皮肤集合目录')
      const library = readLibrary()
      for (const entry of entries) {
        library.packs.push({ id: makeId(), name: entry.name, path: entry.path })
      }
      library.revision += 1
      writeLibrary(library)
      job.status = 'done'
      job.progress = 100
      job.message = '导入完成'
      job.view = view()
    } catch (error) {
      fail(error)
    }
  }

  const fail = (error) => {
    rmSync(target, { recursive: true, force: true })
    job.status = 'error'
    job.error = error instanceof Error ? error.message : String(error)
    job.message = job.error
  }

  const trimmed = url.trim()
  const child = spawn('git', ['clone', '--depth', '1', trimmed, target], { stdio: ['ignore', 'ignore', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString()
    stderr += text
    const line = text.trim()
    if (line) job.message = line
    const percents = line.match(/\d+(?:\.\d+)?%/g)
    if (percents && percents.length > 0) {
      job.progress = Math.max(...percents.map((p) => Number.parseFloat(p)))
    }
  })
  child.on('error', (error) => fail(error))
  child.on('close', (code) => {
    if (code !== 0) {
      fail(new Error(stderr.trim() || `git clone failed with code ${code}`))
      return
    }
    finish()
  })
  return jobId
}

function validateManagedTheme(target) {
  try {
    const stat = statSync(target)
    if (!stat.isDirectory()) return false
    const skinJson = join(target, 'skin.json')
    const bundle = join(target, 'lib', 'client.js')
    return existsSync(skinJson) && existsSync(bundle)
  } catch {
    return false
  }
}

function findSkinDirs(target, maxDepth = 4) {
  if (validateManagedTheme(target)) return [target]
  const results = []
  const seen = new Set()
  const walk = (dir, depth) => {
    if (depth > maxDepth) return
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const name = entry.name
      if (!entry.isDirectory()) continue
      if (name === '.git' || name === 'node_modules' || name === 'lib' || name === 'dist' || name === 'build' || name === '.cache' || name.startsWith('.')) continue
      const full = join(dir, name)
      const resolved = resolve(full)
      if (seen.has(resolved)) continue
      seen.add(resolved)
      if (validateManagedTheme(full)) {
        results.push(full)
        continue
      }
      walk(full, depth + 1)
    }
  }
  walk(target, 0)
  return results
}

function entryName(target, fallback) {
  try {
    const skinPath = join(target, 'skin.json')
    if (existsSync(skinPath)) {
      const skin = JSON.parse(readFileSync(skinPath, 'utf8'))
      if (typeof skin.name === 'string' && skin.name.trim()) return skin.name
      if (typeof skin.nameEn === 'string' && skin.nameEn.trim()) return skin.nameEn
      if (typeof skin.id === 'string' && skin.id.trim()) return skin.id
    }
  } catch {
    // Fall back to directory/file name.
  }
  return fallback
}

function collectThemeEntries(target) {
  return findSkinDirs(target).map((dir) => ({ name: entryName(dir, basename(dir)), path: dir }))
}

function materializeManagedEntries(target) {
  const dirs = findSkinDirs(target)
  if (dirs.length === 0) return []
  const entries = []
  let keepRoot = false
  const rootResolved = resolve(target)
  for (const dir of dirs) {
    if (resolve(dir) === rootResolved) {
      keepRoot = true
      entries.push({ name: entryName(dir, basename(dir)), path: dir })
      continue
    }
    const flatId = makeId()
    const flatTarget = join(THEMES_DIR, flatId)
    rmSync(flatTarget, { recursive: true, force: true })
    mkdirSync(flatTarget, { recursive: true })
    cpSync(dir, flatTarget, { recursive: true })
    entries.push({ name: entryName(dir, basename(dir)), path: flatTarget })
  }
  if (!keepRoot) {
    rmSync(target, { recursive: true, force: true })
  }
  return entries
}

function isManagedPath(target) {
  const resolved = resolve(expandHome(target))
  const root = resolve(THEMES_DIR)
  return resolved === root || resolved.startsWith(root + sep)
}

function removeManagedPath(target) {
  if (!isManagedPath(target)) return
  rmSync(target, { recursive: true, force: true })
  // Clean empty ancestor folders left by old nested collection imports.
  const root = resolve(THEMES_DIR)
  let current = dirname(resolve(target))
  while (current !== root && (current.startsWith(root + sep) || current === root)) {
    try {
      if (readdirSync(current).length > 0) break
      rmSync(current, { recursive: true, force: true })
      current = dirname(current)
    } catch {
      break
    }
  }
}

function resolvePack(pack) {
  const fallback = (extra = {}) => ({
    id: pack && pack.id ? pack.id : '',
    name: pack && typeof pack.name === 'string' && pack.name.trim() ? pack.name : '未命名皮肤',
    ...extra,
  })

  try {
    const path = expandHome(pack && pack.path)
    if (typeof path !== 'string' || path === '') return fallback({ error: '缺少皮肤路径' })
    const stat = statSync(path)
    if (!stat.isDirectory()) return fallback({ error: '不是有效的 DSH 皮肤包：需要 skin.json 和 lib/client.js' })
    const skinPath = join(path, 'skin.json')
    const bundlePath = join(path, 'lib', 'client.js')
    if (!existsSync(skinPath) || !existsSync(bundlePath)) {
      return fallback({ error: '不是有效的 DSH 皮肤包：需要 skin.json 和 lib/client.js' })
    }
    const skin = JSON.parse(readFileSync(skinPath, 'utf8'))
    let inject = []
    let packageName = ''
    try {
      const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'))
      if (pkg && pkg.dsh && pkg.dsh.client && Array.isArray(pkg.dsh.client.inject)) {
        inject = pkg.dsh.client.inject
      }
      if (pkg && typeof pkg.name === 'string') packageName = pkg.name
    } catch {
      // package.json is optional for loading; inject is empty if absent.
    }
    return {
      id: pack.id,
      name: typeof pack.name === 'string' && pack.name.trim() ? pack.name : (typeof skin.name === 'string' ? skin.name : basename(path)),
      bundle: readFileSync(bundlePath, 'utf8'),
      inject,
      packageName,
    }
  } catch (error) {
    return fallback({ error: error instanceof Error ? error.message : String(error) })
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
    if (!write && endpoint === 'importStatus') {
      const jobId = payload && payload.jobId
      const job = typeof jobId === 'string' ? importJobs.get(jobId) : null
      if (!job) {
        return { ok: false, error: { code: 'not-found', message: 'import job not found', details: {} } }
      }
      return {
        ok: true,
        value: {
          status: job.status,
          message: job.message,
          progress: job.progress,
          view: job.status === 'done' ? job.view : undefined,
          error: job.status === 'error' ? job.error : undefined,
        },
      }
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
        entries = materializeManagedEntries(target)
      } else {
        entries = collectThemeEntries(sourcePath)
      }
      if (entries.length === 0) {
        return { ok: false, error: { code: 'invalid-theme', message: '无法识别该路径为皮肤：需要包含 skin.json 和 lib/client.js 的 DSH 皮肤包，或 skins/themes/packages 皮肤集合目录', details: {} } }
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
      const jobId = startGithubImport(url)
      return { ok: true, value: { jobId } }
    }
    if (write && endpoint === 'deletePack') {
      const id = payload && payload.id
      if (typeof id !== 'string' || id === '') {
        return { ok: false, error: { code: 'bad-request', message: 'id is required', details: {} } }
      }
      const library = readLibrary()
      const index = library.packs.findIndex((pack) => pack.id === id)
      if (index < 0) {
        return { ok: false, error: { code: 'not-found', message: '主题不存在', details: {} } }
      }
      const removed = library.packs[index]
      if (removed && typeof removed.path === 'string' && isManagedPath(removed.path)) {
        removeManagedPath(removed.path)
      }
      library.packs.splice(index, 1)
      if (library.activeId === id) library.activeId = null
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
