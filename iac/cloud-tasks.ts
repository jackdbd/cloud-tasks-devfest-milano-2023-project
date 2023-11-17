import * as gcp from "@pulumi/gcp";

// https://www.pulumi.com/registry/packages/gcp/api-docs/cloudtasks/
const queue_name = "my-queue";

export const queue = new gcp.cloudtasks.Queue(queue_name, {
  location: "europe-west3",
  rateLimits: { maxDispatchesPerSecond: 499 },
  retryConfig: { maxAttempts: 99 },
  stackdriverLoggingConfig: { samplingRatio: 0.5 },
});
