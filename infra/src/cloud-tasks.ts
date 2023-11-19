import * as gcp from "@pulumi/gcp";
import { enable_cloud_tasks } from "./services";

const queue_name = "my-queue";

// https://www.pulumi.com/registry/packages/gcp/api-docs/cloudtasks/
export const queue = new gcp.cloudtasks.Queue(
  queue_name,
  {
    location: "europe-west3",
    rateLimits: { maxDispatchesPerSecond: 499 },
    retryConfig: { maxAttempts: 99 },
    stackdriverLoggingConfig: { samplingRatio: 0.5 },
  },
  { dependsOn: [enable_cloud_tasks] }
);
