import * as gcp from "@pulumi/gcp";
import { enqueuer_bucket, enqueuer_bucket_object } from "./cloud-storage";
import { queue } from "./cloud-tasks";
import { config } from "./config";
import { enqueuer_name, enqueuer_location } from "./constants";
import { sa_enqueuer } from "./service-accounts";
import { enable_cloud_build, enable_cloud_functions } from "./services";

export const enqueuer = new gcp.cloudfunctions.Function(
  enqueuer_name,
  {
    availableMemoryMb: 128,
    buildEnvironmentVariables: { AAA: "bbb" },
    description: "Function that enqueues tasks to a Cloud Tasks queue",
    entryPoint: config.require("enqueuer-entry-point"),
    environmentVariables: { NODE_ENV: "production" },
    maxInstances: 3,
    minInstances: 0,
    region: enqueuer_location,
    runtime: "nodejs20",
    serviceAccountEmail: sa_enqueuer.email,
    sourceArchiveBucket: enqueuer_bucket.id,
    // IMPORTANT: use .name in sourceArchiveObject, not .id
    sourceArchiveObject: enqueuer_bucket_object.name,
    timeout: 59,
    triggerHttp: true,
  },
  // The application code of this cloud function creates tasks and sends them to
  // a Cloud Tasks queue. So we declare that queue as an explicit dependency.
  { dependsOn: [enable_cloud_build, enable_cloud_functions, queue] }
);

// https://www.pulumi.com/registry/packages/gcp/api-docs/cloudfunctionsv2/
export const enqueuer_2nd_gen = new gcp.cloudfunctionsv2.Function(
  "enqueuer-2nd-gen",
  {
    location: enqueuer_location,
    description: "Function that enqueues tasks to a Cloud Tasks queue",
    buildConfig: {
      runtime: "nodejs20",
      entryPoint: config.require("enqueuer-entry-point"),
      environmentVariables: {
        THE_ANSWER: "42",
      },
      source: {
        storageSource: {
          bucket: enqueuer_bucket.name,
          object: enqueuer_bucket_object.name,
        },
      },
    },
    serviceConfig: {
      allTrafficOnLatestRevision: true,
      availableMemory: "256M",
      environmentVariables: {
        NODE_ENV: "production",
      },
      ingressSettings: "ALLOW_ALL",
      maxInstanceCount: 2,
      minInstanceCount: 0,
      serviceAccountEmail: sa_enqueuer.email,
      timeoutSeconds: 19,
    },
  },
  // The application code of this cloud function creates tasks and sends them to
  // a Cloud Tasks queue. So we declare that queue as an explicit dependency.
  { dependsOn: [enable_cloud_build, enable_cloud_functions, queue] }
);
