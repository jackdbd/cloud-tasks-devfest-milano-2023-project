import { useEffect, useState } from 'preact/hooks'
import preactLogo from './assets/preact.svg'
import viteLogo from '/vite.svg'
import './app.css'

// see vite.config.ts
declare let __CONFIG: {
  project: string
  api: string
  enqueuer: string
  queue_location: string
  queue_name: string
}

export function App() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    console.log('=== __CONFIG ===', __CONFIG)
  }, [__CONFIG])

  // https://vitejs.dev/guide/env-and-mode.html
  // if (import.meta.env.PROD) { }

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} class="logo" alt="Vite logo" />
        </a>
        <a href="https://preactjs.com" target="_blank">
          <img src={preactLogo} class="logo preact" alt="Preact logo" />
        </a>
      </div>
      <h1>Vite + Preact</h1>
      <div class="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>

        <button
          onClick={async (_ev) => {
            console.log('=== Calling API ===')
            const task_id = `task-id-${Date.now()}`
            // const response = await fetch(`${__CONFIG.api}?task_id=${task_id}`)
            const response = await fetch(`${__CONFIG.api}`, {
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'X-Some-Custom-Request-Header': 'foo'
              },
              method: 'POST',
              body: JSON.stringify({ task_id })
            })
            const res = await response.json()

            console.log(
              '=== Response from API ===',
              response.status,
              response.statusText
            )
            console.log(res)
          }}
        >
          call API directly
        </button>

        <button
          onClick={async (_ev) => {
            console.log('=== Calling enqueuer ===')
            const response = await fetch(`${__CONFIG.enqueuer}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8'
              },
              body: JSON.stringify({
                project: __CONFIG.project,
                location: __CONFIG.queue_location,
                queue: __CONFIG.queue_name,
                url: __CONFIG.api
              })
            })
            const res = await response.json()

            console.log(
              '=== Response from enqueuer ===',
              response.status,
              response.statusText
            )
            console.log(res)
          }}
        >
          call enqueuer (which calls API)
        </button>
      </div>
      <p class="read-the-docs">
        Click on the Vite and Preact logos to learn more
      </p>
    </>
  )
}
