import * as gcp from '@pulumi/gcp'
import { api_name, enqueuer_name, worker_name } from './constants'

const sa_api_id = `${api_name}-user`
const sa_enqueuer_id = `${enqueuer_name}-user`
const sa_worker_id = `${worker_name}-user`

export const sa_api = new gcp.serviceaccount.Account(sa_api_id, {
  accountId: sa_api_id,
  description: 'Service Account for the API server',
  displayName: 'API server service account'
})

export const sa_enqueuer = new gcp.serviceaccount.Account(sa_enqueuer_id, {
  accountId: sa_enqueuer_id,
  description: 'Service Account for the application that enqueues tasks',
  displayName: 'Tasks enqueuer service account'
})

export const sa_worker = new gcp.serviceaccount.Account(sa_worker_id, {
  accountId: sa_worker_id,
  description: 'Service Account for the application that processes tasks',
  displayName: 'Tasks worker service account'
})
