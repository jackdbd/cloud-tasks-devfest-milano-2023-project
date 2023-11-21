import { makeLog } from '@jackdbd/tags-logger'
import functions from '@google-cloud/functions-framework'
import Bottleneck from 'bottleneck'
import { nanoid } from 'nanoid'

const log = makeLog()
// const log = makeLog({ namespace: 'api' })

const reservoir = 5

const limiter = new Bottleneck({
  reservoir, // initial value
  reservoirRefreshAmount: reservoir,
  reservoirRefreshInterval: 10 * 1000, // in ms, must be divisible by 250
  maxConcurrent: 1,
  minTime: 500 // in ms
})

const handler = async (req, res) => {
  const req_id = nanoid()
  // set a request ID in a custom HTTP response header, so it's easy to find in the logs
  res.set('X-Request-ID', req_id)

  log({
    message: `${req.method} ${req.path} request headers for request ${req_id}`,
    tags: ['debug', 'request-headers'],
    ...req.headers
  })

  // IMPORTANT! first, handle the preflight request.

  // https://cloud.google.com/functions/docs/samples/functions-http-cors#functions_http_cors-nodejs
  // const allowed_origins = [
  //   'http://localhost:8090',
  //   'https://storage.googleapis.com'
  // ]
  // if (origin && allowed_origins.includes(origin)) {
  //   res.setHeader('Access-Control-Allow-Origin', origin)
  // }
  // res.set('Access-Control-Allow-Origin', '*')

  if (process.env.DEVELOPMENT) {
    res.set('Access-Control-Allow-Origin', 'http://localhost:8090')
  } else {
    res.set('Access-Control-Allow-Origin', 'https://storage.googleapis.com')
  }

  // allow OPTIONS requests, otherwise preflight requests are blocked by CORS
  res.set('Access-Control-Allow-Methods', 'GET,OPTIONS,POST')
  res.set(
    'Access-Control-Allow-Headers',
    'content-type, x-task-enqueued-by, x-some-custom-request-header'
  )

  // cache preflight response for 3600s
  res.set('Access-Control-Max-Age', '3600')

  if (req.method === 'OPTIONS') {
    return res.status(204).send('')
  }

  if (!['GET', 'POST'].includes(req.method)) {
    const message = `${req.method} method not allowed`
    log({ message, tags: ['warning', 'request-method'] })
    return res.status(405).json({ message })
  }

  if (req.method === 'POST') {
    const content_type = req.header('content-type')
    if (!content_type || !content_type.includes('application/json')) {
      const message = 'Content-Type must include application/json'
      log({ message, tags: ['warning', 'request-headers'] })
      return res.status(400).send({ message })
    }
  }

  let task_id = undefined
  if (req.method === 'GET') {
    task_id = req.query.task_id
  }

  if (req.method === 'POST') {
    task_id = req.body.task_id
  }

  if (!task_id) {
    const message = `task_id is required`
    log({ message, tags: ['warning', 'task-id'] })
    return res.status(400).send({ message })
  }

  let events_endpoint = undefined
  if (req.method === 'GET') {
    events_endpoint = req.query.events_endpoint
  }

  if (req.method === 'POST') {
    events_endpoint = req.body.events_endpoint
  }

  if (!events_endpoint) {
    const message = `events_endpoint is required`
    log({ message, tags: ['warning', 'events-endpoint'] })
    return res.status(400).send({ message })
  }

  log({
    message: `Request info (see payload)`,
    tags: ['debug', 'req-body', 'req-params', 'req-path', 'req-query'],
    body: req.body,
    params: req.params,
    path: req.path,
    query: req.query
  })

  const current_reservoir = await limiter.currentReservoir()

  const body = {
    api_response_sent_at: Date.now(),
    message: `API responded correctly`,
    req_headers: req.headers,
    req_body: req.body,
    req_id,
    req_params: req.params,
    req_path: req.path,
    req_query: req.query,
    reservoir,
    current_reservoir,
    task_id,
    env: {
      HOME: process.env.HOME,
      NODE_ENV: process.env.NODE_ENV,
      PATH: process.env.PATH.split(':'),
      USER: process.env.USER
    }
  }

  // TODO: publish the event to a Cloud Pub/Sub topic, not to this endpoint
  const events_api_response = await fetch(events_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(body)
  })
  const events_res_body = await events_api_response.json()
  log({ message: events_res_body.message, tags: ['info', 'event'] })

  res.status(200).json(body)
}

// not rate-limited
// functions.http('handler', handler)

// rate-limited
functions.http('handler', limiter.wrap(handler))
