import * as path from 'node:path'
import * as pulumi from '@pulumi/pulumi'
import * as gcp from '@pulumi/gcp'
import * as synced from '@pulumi/synced-folder'
import {
  api_location,
  api_name,
  enqueuer_location,
  enqueuer_name,
  enqueuer_2nd_gen_location,
  enqueuer_2nd_gen_name,
  events_server_location,
  events_server_name,
  project,
  queue_location,
  queue_name,
  repo_root
} from './constants'
import { api, enqueuer, enqueuer_2nd_gen } from './cloud-functions'
import { events_service } from './cloud-run'
import { frontend_bucket } from './cloud-storage'
import { queue } from './cloud-tasks'
import { sa_enqueuer } from './service-accounts'

// uncomment this to make the function publicly accessible
new gcp.cloudfunctions.FunctionIamMember('api-cloudfunctions-invoker', {
  cloudFunction: api.name,
  member: 'allUsers',
  region: api_location,
  role: 'roles/cloudfunctions.invoker'
})

new gcp.cloudfunctions.FunctionIamMember('enqueuer-cloudfunctions-invoker', {
  cloudFunction: enqueuer.name,
  member: 'allUsers',
  region: enqueuer_location,
  role: 'roles/cloudfunctions.invoker'
})

new gcp.cloudrunv2.ServiceIamMember('enqueuer-2nd-gen-run-invoker', {
  location: enqueuer_2nd_gen_location,
  member: 'allUsers',
  name: enqueuer_2nd_gen.name,
  role: 'roles/run.invoker'
})

new gcp.cloudrunv2.ServiceIamMember('events-service-run-invoker', {
  location: events_server_location,
  member: 'allUsers',
  name: events_service.name,
  role: 'roles/run.invoker'
})

// Create a JSON file containing all backend URLs and host it on the same bucket
// where it is hosted the frontend.
const config_json = new gcp.storage.BucketObject('config-json', {
  bucket: frontend_bucket.name,
  // cacheControl: "public, max-age=10",
  cacheControl: 'no-store',
  contentType: 'application/json',
  name: 'config.json',
  source: pulumi
    .all([api.httpsTriggerUrl, enqueuer.httpsTriggerUrl, events_service.uri])
    .apply(([api_url, enqueuer_url, sse_server_url]) => {
      return new pulumi.asset.StringAsset(
        JSON.stringify({
          api: api_url,
          enqueuer: enqueuer_url,
          events_endpoint: `${sse_server_url}/events`,
          project,
          queue_location,
          queue_name,
          sse_endpoint: `${sse_server_url}/sse`
        })
      )
    })
})

new synced.GoogleCloudFolder('synced-folder', {
  bucketName: frontend_bucket.name,
  path: path.join(repo_root, 'packages', 'frontend', 'dist')
})

new gcp.storage.BucketIAMBinding('frontend-bucket-iam-binding', {
  bucket: frontend_bucket.name,
  role: 'roles/storage.objectViewer',
  members: ['allUsers']
})

const serviceaccount_users = new gcp.projects.IAMBinding(
  'serviceaccount-users',
  {
    project,
    role: 'roles/iam.serviceAccountUser',
    members: [sa_enqueuer.email.apply((email) => `serviceAccount:${email}`)]
  }
)

export const service_account_users = serviceaccount_users.members

new gcp.cloudtasks.QueueIamBinding('cloudtasks-enqueuers', {
  location: queue_location,
  members: [sa_enqueuer.email.apply((email) => `serviceAccount:${email}`)],
  name: queue.name,
  // https://cloud.google.com/tasks/docs/reference-access-control#roles
  role: 'roles/cloudtasks.enqueuer'
})

export const frontend = pulumi.interpolate`https://storage.googleapis.com/${frontend_bucket.name}/${frontend_bucket.website.mainPageSuffix}`

export const backend_services = {
  [api_name]: api.httpsTriggerUrl,
  [enqueuer_name]: enqueuer.httpsTriggerUrl,
  [enqueuer_2nd_gen_name]: enqueuer_2nd_gen.url,
  [events_server_name]: events_service.uri
}

// I think it's always a good idea to show the IAM bindings of the Google Cloud
// project and other important Google Cloud resources.
export const project_iam_bindings = gcp.projects
  .getIamPolicyOutput({ project })
  .policyData.apply((d) => JSON.parse(d).bindings)

export const queue_iam_bindings = gcp.cloudtasks
  .getQueueIamPolicyOutput({
    project,
    location: queue_location,
    name: queue_name
  })
  .policyData.apply((d) => JSON.parse(d).bindings)
