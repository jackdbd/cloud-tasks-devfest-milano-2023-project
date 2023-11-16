import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

const project = "devfest-milano-2023";

// https://www.pulumi.com/registry/packages/gcp/api-docs/cloudtasks/
const queue_name = "my-queue";
const queue = new gcp.cloudtasks.Queue(queue_name, {
  location: "europe-west3",
  name: queue_name,
  rateLimits: { maxDispatchesPerSecond: 499 },
  retryConfig: { maxAttempts: 99 },
  stackdriverLoggingConfig: { samplingRatio: 0.5 },
});

const queue_id = queue.id;
const queue_rate_limits = queue.rateLimits;
const queue_retry_config = queue.retryConfig;
const queue_logging = queue.stackdriverLoggingConfig;

// https://www.pulumi.com/registry/packages/gcp/api-docs/cloudfunctionsv2/
// const func = new gcp.cloudfunctionsv2.Function("enqueuer", {
//   location: "europe-west8",
//   description: "Function that enqueues tasks to a Cloud Tasks queue",
//   buildConfig: {
//     runtime: "nodejs20",
//     entryPoint: "helloGET",
//     environmentVariables: {
//       AAA: "bbb",
//     },
//     source: {
//       storageSource: {
//         bucket: "my-source-bucket", // The Source code is stored in Cloud Storage bucket
//         object: "function.zip", // The object in the bucket
//       },
//     },
//   },
//   serviceConfig: {
//     allTrafficOnLatestRevision: true,
//     availableMemory: "256M",
//     environmentVariables: {
//       SERVICE_CONFIG: "config_test",
//     },
//     maxInstanceCount: 2,
//     minInstanceCount: 1,
//     // serviceAccountEmail: account.email,
//     timeoutSeconds: 60,
//     // ingressSettings: "ALLOW_INTERNAL_ONLY",
//   },
//   //   eventTrigger: {
//   //     eventType: "google.cloud.functions.v1.CloudFunctionsFunction.HttpRequest", // Trigger on HTTP requests
//   //   },
// });

const enqueuer_location = "europe-west8";
const worker_location = "europe-west8";

const enqueuer_name = "enqueuer";
const worker_name = "worker";

const sa_enqueuer_id = `${enqueuer_name}-user`;
const sa_worker_id = `${worker_name}-user`;

// https://www.pulumi.com/registry/packages/gcp/api-docs/serviceaccount/account/
const sa_enqueuer = new gcp.serviceaccount.Account(sa_enqueuer_id, {
  accountId: sa_enqueuer_id,
  description: "Service Account for the application that enqueues tasks",
  displayName: "Tasks enqueuer service account",
});

const sa_worker = new gcp.serviceaccount.Account(sa_worker_id, {
  accountId: sa_worker_id,
  description: "Service Account for the application that processes tasks",
  displayName: "Tasks worker service account",
});

// https://www.pulumi.com/registry/packages/gcp/api-docs/cloudrunv2/
const worker = new gcp.cloudrunv2.Service(
  worker_name,
  {
    description:
      "Service that processes the tasks dispatched by a Cloud Tasks queue",
    ingress: "INGRESS_TRAFFIC_ALL",
    location: worker_location,
    name: worker_name,
    template: {
      containers: [
        {
          envs: [{ name: "THE_ANSWER", value: "42" }],
          image: "us-docker.pkg.dev/cloudrun/container/hello",
          startupProbe: {
            failureThreshold: 3,
            initialDelaySeconds: 1,
            periodSeconds: 240,
            tcpSocket: { port: 8080 },
            timeoutSeconds: 10,
          },
        },
      ],
      maxInstanceRequestConcurrency: 10,
      timeout: "2.5s",
      serviceAccount: sa_worker.email,
      scaling: { maxInstanceCount: 1, minInstanceCount: 0 },
    },
    traffics: [{ percent: 100, type: "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST" }],
  },
  { dependsOn: [queue] }
);

// export const worker_policy = gcp.cloudrunv2.getServiceIamPolicy({
//   location: worker_location,
//   name: worker_name,
// });

// export const worker_iam_bindings = worker_policy.then(
//   (pr) => JSON.parse(pr.policyData).bindings
// );

// const binding = new gcp.cloudrunv2.ServiceIamBinding("worker-iam-binding", {})

// export const worker_id = worker.id;
// export const worker_etag = worker.etag;
// export const worker_ingress = worker.ingress;
// export const worker_template = worker.template;
// export const worker_terminal_conditions = worker.terminalConditions;
export const worker_uri = worker.uri;

// Here are two equivalent ways to retrieve the IAM bindings for the GCP project

// const project_policy = gcp.projects.getIamPolicy({ project });
// export const project_iam_bindings = project_policy.then(
//   (pr) => JSON.parse(pr.policyData).bindings
// );

const project_policy = gcp.projects.getIamPolicyOutput({ project });
export const project_iam_bindings = project_policy.policyData.apply(
  (d) => JSON.parse(d).bindings
);
