import { CloudTasksClient } from '@google-cloud/tasks'
import functions from '@google-cloud/functions-framework'
import { makeLog } from '@jackdbd/tags-logger'
import { nanoid } from 'nanoid'

const log = makeLog({ namespace: 'enqueuer' })

const cloud_tasks = new CloudTasksClient()

functions.http('enqueueTask', async (req, res) => {
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
  // res.set('Access-Control-Allow-Origin', '*')

  if (process.env.DEVELOPMENT) {
    res.set('Access-Control-Allow-Origin', 'http://localhost:8090')
  } else {
    res.set('Access-Control-Allow-Origin', 'https://storage.googleapis.com')
  }

  // allow OPTIONS requests, otherwise preflight requests are blocked by CORS
  res.set('Access-Control-Allow-Methods', 'GET,OPTIONS,POST')

  res.set('Access-Control-Allow-Headers', 'content-type')

  // cache preflight response for 3600s
  res.set('Access-Control-Max-Age', '3600')

  if (req.method === 'OPTIONS') {
    return res.status(204).send('')
  }

  if (req.method !== 'POST') {
    const message = `${req.method} method not allowed`
    log({ message, tags: ['warning', 'request-method'] })
    return res.status(405).json({ message })
  }

  const content_type = req.header('content-type')
  if (!content_type || !content_type.includes('application/json')) {
    const message = 'Content-Type must include application/json'
    log({ message, tags: ['warning', 'request-headers'] })
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

  if (!req.body.project) {
    return res.status(400).send({ message: 'project is required' })
  }

  if (!req.body.location) {
    return res.status(400).send({ message: 'location is required' })
  }

  if (!req.body.queue) {
    return res.status(400).send({ message: 'queue is required' })
  }

  if (!req.body.url) {
    return res.status(400).send({ message: 'url is required' })
  }

  if (!req.body.events_endpoint) {
    return res.status(400).send({ message: 'events_endpoint is required' })
  }

  const parent = cloud_tasks.queuePath(
    req.body.project,
    req.body.location,
    req.body.queue
  )
  const task_id = `call-api-task-${Date.now()}`

  log({
    message: `create task ${task_id} for queue ${parent}`,
    tags: ['debug', 'cloud-tasks']
  })

  const payload = { events_endpoint: req.body.events_endpoint, task_id }
  const enqueued_by = 'enqueuer'

  // schedule the task 5 seconds from now
  const seconds = Date.now() / 1000 + 5

  try {
    const [task] = await cloud_tasks.createTask({
      parent,
      task: {
        scheduleTime: { seconds },
        httpRequest: {
          body: Buffer.from(JSON.stringify(payload)).toString('base64'),
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Task-Enqueued-By': enqueued_by
          },
          httpMethod: 'POST',
          url: req.body.url
        },
        name: `${parent}/tasks/${task_id}`
      }
    })

    res.status(201).json({
      enqueuer_response_sent_at: Date.now(),
      message: `Task ID ${task_id} created and sent to Cloud Tasks queue ${parent}`,
      req_headers: req.headers,
      req_body: req.body,
      req_id,
      req_params: req.params,
      req_path: req.path,
      req_query: req.query,
      task
    })
  } catch (err) {
    log({
      message: `could not create task ${task_id} in queue ${parent}`,
      tags: ['error', 'cloud-tasks'],
      error_message: err.message
    })

    res.status(500).json({
      message: `could not create task ${task_id} in queue ${parent}`,
      errored: true,
      error_message: err.message
    })
  }
})
