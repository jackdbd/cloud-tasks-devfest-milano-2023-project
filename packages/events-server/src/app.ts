import { fastify } from 'fastify'
import { FastifySSEPlugin } from 'fastify-sse-v2'
import { nanoid } from 'nanoid'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface AppEvent {
  event_id: string
  payload: any
  request_id: string
  timestamp: number
}

// In reality we would store our application events in a database.
// For example we could store them in a single Firestore collection.
const events: AppEvent[] = []

export const event_source = async function* source({ ms }: { ms: number }) {
  while (true) {
    const event = events.pop()
    if (event) {
      yield { data: JSON.stringify(event) }
    }
    await sleep(ms)
  }
}

export const app = async () => {
  const server = fastify({ logger: true })
  server.register(FastifySSEPlugin)

  const sse_interval_ms = 5000

  server.get('/', (_req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Access-Control-Allow-Methods', 'GET')

    reply.send({
      message: `This server stores events and sends them to a client every ${sse_interval_ms} ms using Server-Sent Events`
    })
  })

  server.get('/sse', function (req, reply) {
    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Access-Control-Allow-Methods', 'GET')

    const user_agent = req.headers['user-agent'] || 'unknown user agent'
    req.log.info(`deliver event to ${user_agent}`)

    reply.sse(event_source({ ms: sse_interval_ms }))
  })

  server.post('/events', function (req, reply) {
    const request_id = req.id
    const event_id = nanoid()
    const timestamp = Date.now()

    // in reality we would store the events in a database, not in an array
    events.push({
      event_id,
      payload: req.body,
      request_id,
      timestamp
    })

    reply.status(201).send({
      message: `Request ID ${request_id} stored event ID ${event_id} at timestamp ${timestamp}`
    })
  })

  return { server }
}
