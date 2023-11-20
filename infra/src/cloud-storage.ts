import * as path from 'node:path'
import * as pulumi from '@pulumi/pulumi'
import * as gcp from '@pulumi/gcp'
import {
  api_location,
  enqueuer_location,
  frontend_bucket_name,
  repo_root
} from './constants'

export const api_bucket = new gcp.storage.Bucket('api-bucket', {
  location: api_location,
  storageClass: 'STANDARD',
  uniformBucketLevelAccess: true
})

export const api_bucket_object = new gcp.storage.BucketObject('api-archive', {
  bucket: api_bucket.id,
  // All content found at this path will be uploaded as zip archive to the
  // Cloud Storage bucket `api_bucket`
  source: new pulumi.asset.FileArchive(path.join(repo_root, 'packages', 'api'))
})

export const enqueuer_bucket = new gcp.storage.Bucket('enqueuer-bucket', {
  location: enqueuer_location,
  storageClass: 'STANDARD',
  uniformBucketLevelAccess: true
})

export const enqueuer_bucket_object = new gcp.storage.BucketObject(
  'enqueuer-archive',
  {
    bucket: enqueuer_bucket.id,
    // All content found at this path will be uploaded as zip archive to the
    // Cloud Storage bucket `enqueuer_bucket`
    source: new pulumi.asset.FileArchive(
      path.join(repo_root, 'packages', 'enqueuer')
    )
  }
)

export const frontend_bucket = new gcp.storage.Bucket(frontend_bucket_name, {
  cors: [
    {
      methods: ['GET', 'OPTIONS', 'POST'],
      // origins: ['*'],
      origins: ['https://storage.googleapis.com'],
      responseHeaders: ['*']
    }
  ],
  location: 'EU',
  name: frontend_bucket_name,
  storageClass: 'STANDARD',
  uniformBucketLevelAccess: true,
  website: {
    mainPageSuffix: 'index.html'
    // notFoundPage: '404.html'
  }
})
