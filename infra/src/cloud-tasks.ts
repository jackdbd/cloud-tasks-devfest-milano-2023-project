import * as gcp from '@pulumi/gcp'
import { queue_location, queue_name } from './constants'
import { enable_cloud_tasks } from './services'

// https://www.pulumi.com/registry/packages/gcp/api-docs/cloudtasks/
export const queue = new gcp.cloudtasks.Queue(
  queue_name,
  {
    location: queue_location,
    name: queue_name,
    rateLimits: { maxDispatchesPerSecond: 499 },
    retryConfig: { maxAttempts: 99 },
    stackdriverLoggingConfig: { samplingRatio: 0.5 }
  },
  { dependsOn: [enable_cloud_tasks] }
)
