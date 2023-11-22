import * as gcp from '@pulumi/gcp'

export const enable_artifact_registry = new gcp.projects.Service(
  'enable-artifact-registry-api',
  {
    service: 'artifactregistry.googleapis.com'
  }
)

export const enable_cloud_build = new gcp.projects.Service(
  'enable-cloud-build-api',
  {
    service: 'cloudbuild.googleapis.com'
  }
)

// https://cloud.google.com/firestore/docs/reference/rest/
export const enable_cloud_firestore = new gcp.projects.Service(
  'enable-cloud-firestore-api',
  {
    service: 'firestore.googleapis.com',
    disableOnDestroy: true
  }
)

export const enable_cloud_functions = new gcp.projects.Service(
  'enable-cloud-functions-api',
  {
    service: 'cloudfunctions.googleapis.com',
    disableOnDestroy: true
  }
)

export const enable_cloud_run = new gcp.projects.Service(
  'enable-cloud-run-api',
  {
    service: 'run.googleapis.com',
    disableOnDestroy: true
  }
)

export const enable_cloud_tasks = new gcp.projects.Service(
  'enable-cloud-tasks-api',
  {
    service: 'cloudtasks.googleapis.com'
  }
)
