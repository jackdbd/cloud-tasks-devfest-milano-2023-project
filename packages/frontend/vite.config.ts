import url from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import type { UserConfig } from 'vite'
import preact from '@preact/preset-vite'

export const repo_root = path.resolve(__filename, '..', '..', '..')

const bucket_root =
  'https://storage.googleapis.com/cloud-tasks-devfest-milano-2023-frontend'

// https://vitejs.dev/config/
export default defineConfig(async ({ command, mode }) => {
  let config: UserConfig = {
    plugins: [preact()],
    resolve: {
      alias: {
        '@': url.fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  }

  // It's better to use `mode === 'production'` rather than `command === 'build'`
  // so the configuration is fetched from Cloud Storage when:
  // 1. the app is hosted on Cloud Storage
  // 2. the app is served locally by vite preview
  if (mode === 'production') {
    const config_url = `${bucket_root}/config.json`
    console.log(`fetch config from Cloud Storage`, config_url)
    const res = await fetch(config_url)
    const cfg = await res.json()
    console.log(`config retrieved from Cloud Storage`, cfg)

    config = {
      ...config,
      base: bucket_root,
      define: {
        __CONFIG: JSON.stringify(cfg)
      }
    }
  } else {
    const filepath = path.join(repo_root, 'config', 'config-local.json')
    console.log(`read config from file system`, filepath)
    const cfg = fs.readFileSync(filepath, 'utf-8')
    console.log(`config retrieved from file system`, cfg)
    config = {
      ...config,
      define: {
        __CONFIG: cfg
      },
      // https://github.com/expressjs/cors#configuration-options
      server: { cors: { origin: '*' } }
    }
  }

  // console.log(`Vite mode: ${mode} - user config`, config)
  return config
})
