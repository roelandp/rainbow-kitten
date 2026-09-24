import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

/** Writes version.json and stamps the service worker so every deploy is a new SW. */
function versionStamp(): Plugin {
  return {
    name: 'version-stamp',
    apply: 'build',
    writeBundle(opts) {
      const out = opts.dir ?? resolve('dist')
      writeFileSync(resolve(out, 'version.json'), JSON.stringify({ commit, builtAt }) + '\n')
    },
    generateBundle(_, bundle) {
      const sw = bundle['sw.js']
      if (sw && sw.type === 'asset') {
        sw.source = String(sw.source).replace('__BUILD_ID__', `${commit}-${builtAt}`)
      }
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
