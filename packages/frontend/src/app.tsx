import { useEffect } from 'preact/hooks'
import { useSignal } from '@preact/signals'
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

interface ServerSentEvent {
  event_id: string
  // payload: { message: string  }
  payload: any
  request_id: string
  timestamp: number
}

interface EventSourceConfig {
  onMessage: (ev: MessageEvent<any>) => void
  url: string
}

const defEventSource = ({ onMessage, url }: EventSourceConfig) => {
  const es = new EventSource(url)

  const onOpen = (_ev: Event) => {
    console.log(`🔗 [SSE] established HTTP connection with ${es.url}`)
  }

  const onError = (ev: any) => {
    console.log(`❌ SSE error`, ev)
    if (ev.readyState == EventSource.CLOSED) {
      console.log(`closed HTTP connection with ${es.url}`)
    }
  }

  es.addEventListener('open', onOpen)
  es.addEventListener('error', onError)
  es.addEventListener('message', onMessage)

  return {
    event_source: es,
    listeners_map: { open: onOpen, error: onError, message: onMessage }
  }
}

let initial_events: ServerSentEvent[] = []

initial_events = [
  {
    timestamp: 1700586583115,
    request_id: 'request-123',
    event_id: 'event-foobar',
    payload: { message: 'foobar' }
  }
]

export function App() {
  const events = useSignal(initial_events)

  const onMessage = (ev: MessageEvent<any>) => {
    console.log('🚀 ~ onMessage ~ ev:', ev)
    const data = JSON.parse(ev.data) as ServerSentEvent
    console.log(
      `📬 [SSE] message from ${ev.origin} at ${ev.timeStamp} ms`,
      data
    )
    events.value = [...events.value, data]
  }

  useEffect(() => {
    console.group('__CONFIG')
    console.table(__CONFIG)
    console.groupEnd()

    console.group('SSE')
    console.time('SSE')
    const { event_source, listeners_map } = defEventSource({
      onMessage,
      url: __CONFIG.sse_endpoint
    })
    console.timeEnd('SSE')
    console.groupEnd()

    return () => {
      removeEventListener('open', listeners_map.open)
      removeEventListener('error', listeners_map.error)
      removeEventListener('message', listeners_map.message)

      event_source.close()
    }
  }, [__CONFIG])

  // https://vitejs.dev/guide/env-and-mode.html
  // if (import.meta.env.PROD) { }

  return (
    <>
      <div class="text-align:center">
        <h1 class="">Try me!</h1>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} class="logo" alt="Vite logo" />
        </a>
      </div>
      <div class="box">
        <ul class="cluster">
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
            call API
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
            call enqueuer
          </button>
        </ul>
      </div>

      <div class="box event-log-wrapper">
        <h3 class="margin:0">Event log</h3>
        <ul class="stack event-log">
          {events.value.map((ev, _i) => {
            const utc_iso_string = new Date(ev.timestamp).toISOString()
            const event_id = ev.event_id

            let ua = 'unknown user agent'
            if (
              ev.payload &&
              ev.payload.req_headers &&
              ev.payload.req_headers['user-agent']
            ) {
              ua = ev.payload.req_headers['user-agent']
            }

            const code = JSON.stringify(
              {
                message: ev.payload.message,
                'user-agent': ua
              },
              null,
              2
            )

            return (
              <li class="event-log-entry" key={event_id}>
                <div class="box stack">
                  <p>
                    <b>Event ID:</b>&nbsp;<code>{event_id}</code>
                  </p>
                  <p>
                    <b>UTC:</b>&nbsp;<code>{utc_iso_string}</code>
                  </p>
                  <code class="box">{code}</code>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
