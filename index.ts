import * as gcp from "@pulumi/gcp";
import {
  project,
  enqueuer_location,
  enqueuer_name,
  worker_location,
} from "./iac/constants";
import { sa_enqueuer } from "./iac/service-accounts";
import { enqueuer_bucket, enqueuer_bucket_object } from "./iac/cloud-storage";
import { worker } from "./iac/cloud-run";
import { queue } from "./iac/cloud-tasks";
import { config } from "./iac/config";

new gcp.projects.Service("enable-cloud-build-api", {
  service: "cloudbuild.googleapis.com",
});

new gcp.projects.Service("enable-cloud-functions-api", {
  service: "cloudfunctions.googleapis.com",
  disableOnDestroy: true,
});

new gcp.projects.Service("enable-cloud-run-api", {
  service: "run.googleapis.com",
  disableOnDestroy: true,
});

const enqueuer = new gcp.cloudfunctions.Function(
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
  { dependsOn: [queue] }
);

const enqueuer_invoker = new gcp.cloudfunctions.FunctionIamMember(
  "enqueuer-invoker",
  {
    cloudFunction: enqueuer.id,
    member: "allUsers",
    project,
    region: enqueuer_location,
    role: "roles/cloudfunctions.invoker",
  }
);

// https://www.pulumi.com/registry/packages/gcp/api-docs/cloudfunctionsv2/
const enqueuer_2nd_gen = new gcp.cloudfunctionsv2.Function(
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
  { dependsOn: [queue] }
);

// https://www.pulumi.com/registry/packages/gcp/api-docs/cloudfunctionsv2/functioniambinding/
// // TODO: this does not work
// export const enqueuer_functions_invoker_binding =
//   new gcp.cloudfunctionsv2.FunctionIamBinding(
//     "enqueuer-functions-invoker-binding",
//     {
//       cloudFunction: enqueuer_2nd_gen.id,
//       location: enqueuer_location,
//       members: ["allUsers"],
//       role: "roles/cloudfunctions.invoker",
//     }
//   );

// // TODO: this throws an invalid argument exception
// export const enqueuer_run_invoker_binding =
//   new gcp.cloudfunctionsv2.FunctionIamBinding("enqueuer-run-invoker-binding", {
//     cloudFunction: enqueuer_2nd_gen.id,
//     location: enqueuer_location,
//     members: ["allUsers"],
//     role: "roles/run.invoker",
//   });

// // TODO: this does not work
// export const enqueuer_2nd_gen_invoker =
//   new gcp.cloudfunctionsv2.FunctionIamMember("enqueuer-2nd-gen-invoker", {
//     cloudFunction: enqueuer_2nd_gen.id,
//     location: enqueuer_location,
//     member: "allUsers",
//     role: "roles/cloudfunctions.invoker",
//   });

// https://www.pulumi.com/registry/packages/gcp/api-docs/cloudrunv2/serviceiambinding/
// // TODO: this throws this exception: Resource 'worker-invoker-binding-dcbad61'
// // of kind 'SERVICE' in region 'europe-west8' in project 'devfest-milano-2023'
// // does not exist.
// export const worker_invoker_binding = new gcp.cloudrunv2.ServiceIamBinding(
//   "worker-invoker-binding",
//   {
//     location: worker_location,
//     members: ["allUsers"],
//     project,
//     role: "roles/run.invoker",
//   },
//   { dependsOn: [worker] }
// );

// TODO: this does not work. It tells me that it cannot find the resource
// worker-invoker-b2a1d67. Strange, I thought this would CREATE such resource.
// export const worker_invoker = new gcp.cloudrunv2.ServiceIamMember(
//   "worker-invoker",
//   {
//     location: worker_location,
//     member: "allUsers",
//     // project,
//     role: "roles/run.invoker",
//   },
//   { dependsOn: [worker] }
// );

// TODO: this works, but I want to create a IAM binding JUST for ONE Cloud Run
// service, not for all Cloud Run services of the project.
// export const iam_binding = new gcp.projects.IAMBinding(
//   "binding",
//   {
//     members: ["allUsers"],
//     project,
//     role: "roles/run.invoker",
//   },
//   { dependsOn: [worker] }
// );

const project_policy = gcp.projects.getIamPolicyOutput({ project });

// I think it's always a good idea to show the GCP project IAM bindings in the
// dashboard of the Pulumi Stack.
export const project_iam_bindings = project_policy.policyData.apply(
  (d) => JSON.parse(d).bindings
);

export const publicly_accessible_services = {
  enqueuer: enqueuer.httpsTriggerUrl,
  // enqueuer_2nd_gen: enqueuer_2nd_gen.url,
  worker: worker.uri,
};
