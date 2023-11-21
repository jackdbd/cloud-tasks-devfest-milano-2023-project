import { useEffect } from 'preact/hooks'
import preactLogo from './assets/preact.svg'
import viteLogo from '/vite.svg'
import './app.css'

// see vite.config.ts
declare let __CONFIG: {
  project: string
  api: string
  enqueuer: string
  events_endpoint: string
  queue_location: string
  queue_name: string
  sse_endpoint: string
}

function enableSSE() {
  console.group('SSE')
  console.time('SSE')

  const sse = new EventSource(__CONFIG.sse_endpoint)
  console.log(
    `created EventSource to receive server-sent events from ${sse.url}`
  )

  sse.addEventListener('open', function (_ev) {
    console.log(`established HTTP connection with ${sse.url}`)
  })

  sse.addEventListener('message', function (ev) {
    const data = JSON.parse(ev.data)
    console.log(`✉️ message from ${ev.origin} at ${ev.timeStamp} ms`, data)
  })

  sse.addEventListener('error', function (ev: any) {
    console.log(`SSE error`, ev)
    if (ev.readyState == EventSource.CLOSED) {
      console.log(`closed HTTP connection with ${sse.url}`)
    }
  })

  console.timeEnd('SSE')
  console.groupEnd()
}

export function App() {
  useEffect(() => {
    console.group('__CONFIG')
    console.table(__CONFIG)
    console.groupEnd()
    enableSSE()
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
        <button
          onClick={async (_ev) => {
            console.group('API')
            console.time('API response')

            const task_id = `task-id-${Date.now()}`
            // const response = await fetch(`${__CONFIG.api}?task_id=${task_id}`)
            const response = await fetch(`${__CONFIG.api}`, {
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'X-Some-Custom-Request-Header': 'foo'
              },
              method: 'POST',
              body: JSON.stringify({
                events_endpoint: __CONFIG.events_endpoint,
                task_id
              })
            })
            const res = await response.json()

            console.timeEnd('API response')
            console.log(res)
            console.groupEnd()
          }}
        >
          call API directly
        </button>

        <button
          onClick={async (_ev) => {
            console.group('Enqueuer')
            console.time('Enqueuer')

            const response = await fetch(`${__CONFIG.enqueuer}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8'
              },
              body: JSON.stringify({
                events_endpoint: __CONFIG.events_endpoint,
                project: __CONFIG.project,
                location: __CONFIG.queue_location,
                queue: __CONFIG.queue_name,
                url: __CONFIG.api
              })
            })
            const res = await response.json()

            console.timeEnd('Enqueuer')
            console.log(res)
            console.groupEnd()
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
