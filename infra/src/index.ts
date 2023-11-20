import * as path from 'node:path'
import * as pulumi from '@pulumi/pulumi'
import * as gcp from '@pulumi/gcp'
import * as synced from '@pulumi/synced-folder'
import {
  api_location,
  enqueuer_location,
  project,
  queue_location,
  queue_name,
  repo_root,
  worker_location
} from './constants'
import { api, enqueuer } from './cloud-functions'
import { sse_backend_service } from './cloud-run'
import { frontend_bucket } from './cloud-storage'
import { queue } from './cloud-tasks'
import { sa_enqueuer } from './service-accounts'

// uncomment this to make the function publicly accessible
const api_cloudfunctions_invoker = new gcp.cloudfunctions.FunctionIamMember(
  'api-cloudfunctions-invoker',
  {
    cloudFunction: api.name,
    member: 'allUsers',
    region: api_location,
    role: 'roles/cloudfunctions.invoker'
  }
)

const enqueuer_cloudfunctions_invoker =
  new gcp.cloudfunctions.FunctionIamMember('enqueuer-cloudfunctions-invoker', {
    cloudFunction: enqueuer.name,
    member: 'allUsers',
    region: enqueuer_location,
    role: 'roles/cloudfunctions.invoker'
  })

const sse_backend_run_invoker = new gcp.cloudrunv2.ServiceIamMember(
  'sse-backend-run-invoker',
  {
    location: worker_location,
    member: 'allUsers',
    name: sse_backend_service.name,
    role: 'roles/run.invoker'
  }
)

// Create a JSON file containing all backend URLs and host it on the same bucket
// where it is hosted the frontend.
const config_json = new gcp.storage.BucketObject('config-json', {
  bucket: frontend_bucket.name,
  // cacheControl: "public, max-age=10",
  cacheControl: 'no-store',
  contentType: 'application/json',
  name: 'config.json',
  source: pulumi
    .all([api.httpsTriggerUrl, enqueuer.httpsTriggerUrl])
    .apply(([api_url, enqueuer_url]) => {
      return new pulumi.asset.StringAsset(
        JSON.stringify({
          api: api_url,
          enqueuer: enqueuer_url,
          project,
          queue_location,
          queue_name
        })
      )
    })
})

const synced_folder = new synced.GoogleCloudFolder('synced-folder', {
  bucketName: frontend_bucket.name,
  path: path.join(repo_root, 'packages', 'frontend', 'dist')
})

const frontend_bucket_IAM_binding = new gcp.storage.BucketIAMBinding(
  'frontend-bucket-iam-binding',
  {
    bucket: frontend_bucket.name,
    role: 'roles/storage.objectViewer',
    members: ['allUsers']
  }
)

const serviceaccount_users = new gcp.projects.IAMBinding(
  'serviceaccount-users',
  {
    project,
    role: 'roles/iam.serviceAccountUser',
    members: [sa_enqueuer.email.apply((email) => `serviceAccount:${email}`)]
  }
)

export const service_account_users = serviceaccount_users.members

// this does NOT work (I think)
// export const cloudtasks_enqueuers = new gcp.projects.IAMBinding(
//   'cloudtasks-enqueuers',
//   {
//     members: [sa_enqueuer.email.apply((email) => `serviceAccount:${email}`)],
//     // https://cloud.google.com/tasks/docs/reference-access-control#roles
//     role: 'roles/cloudtasks.enqueuer',
//     project
//   }
// )

// this works
const cloudtasks_enqueuers = new gcp.cloudtasks.QueueIamBinding(
  'cloudtasks-enqueuers',
  {
    location: queue_location,
    members: [sa_enqueuer.email.apply((email) => `serviceAccount:${email}`)],
    name: queue.name,
    // https://cloud.google.com/tasks/docs/reference-access-control#roles
    role: 'roles/cloudtasks.enqueuer'
  }
)

export const frontend = pulumi.interpolate`https://storage.googleapis.com/${frontend_bucket.name}/${frontend_bucket.website.mainPageSuffix}`

// const services_url = {
//   api: api.httpsTriggerUrl,
//   enqueuer: enqueuer.httpsTriggerUrl,
//   frontend: pulumi.interpolate`https://storage.googleapis.com/${frontend_bucket.name}/${frontend_bucket.website.mainPageSuffix}`
//   // sse_backend: sse_backend_service.uri,
// }

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
