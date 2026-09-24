import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { defineConfig, Plugin } from 'vite'

function gitCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    return dirty ? `${sha}+` : sha
  } catch {
    return 'dev'
  }
}

const commit = gitCommit()
const builtAt = new Date().toISOString()

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? listFiles(p) : [p]
  })
}

/**
 * After the build: write version.json, and stamp the service worker with the build id and the
 * list of files to keep for offline play. A new id means a new service worker on every deploy.
 */
function versionStamp(): Plugin {
  let outDir = resolve('dist')
  return {
    name: 'version-stamp',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir)
    },
    closeBundle() {
      writeFileSync(join(outDir, 'version.json'), JSON.stringify({ commit, builtAt }) + '\n')
      const swPath = join(outDir, 'sw.js')
      if (!existsSync(swPath)) return
      const files = listFiles(outDir)
        .map((f) => relative(outDir, f).split('\\').join('/'))
        .filter((f) => !['sw.js', 'version.json'].includes(f) && !f.endsWith('.map'))
        .map((f) => `./${f}`)
      const sw = readFileSync(swPath, 'utf8')
        .replace('__BUILD_ID__', `${commit}-${builtAt}`)
        .replace('__PRECACHE__', JSON.stringify(['./', ...files]))
      writeFileSync(swPath, sw)
    },
  }
}

export default defineConfig({
  base: './',
  define: {
    __COMMIT__: JSON.stringify(commit),
    __BUILT_AT__: JSON.stringify(builtAt),
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
  plugins: [versionStamp()],
})
