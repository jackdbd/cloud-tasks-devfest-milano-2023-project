import * as path from "node:path";
import { cwd } from "node:process";
import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as gcp from "@pulumi/gcp";
import * as synced from "@pulumi/synced-folder";
import {
  project,
  enqueuer_location,
  enqueuer_name,
  worker_location,
} from "./iac/constants";
import { sa_enqueuer, sa_worker } from "./iac/service-accounts";
import {
  enqueuer_bucket,
  enqueuer_bucket_object,
  frontend_bucket,
} from "./iac/cloud-storage";
import { worker } from "./iac/cloud-run";
import { queue } from "./iac/cloud-tasks";
import { config } from "./iac/config";

const enable_artifact_registry = new gcp.projects.Service(
  "enable-artifact-registry-api",
  {
    service: "artifactregistry.googleapis.com",
  }
);

const enable_cloud_build = new gcp.projects.Service("enable-cloud-build-api", {
  service: "cloudbuild.googleapis.com",
});

const enable_cloud_functions = new gcp.projects.Service(
  "enable-cloud-functions-api",
  {
    service: "cloudfunctions.googleapis.com",
    disableOnDestroy: true,
  }
);

const enable_cloud_run = new gcp.projects.Service("enable-cloud-run-api", {
  service: "run.googleapis.com",
  disableOnDestroy: true,
});

const repo_root = cwd();

// https://www.pulumi.com/registry/packages/gcp/api-docs/artifactregistry/repository/
export const docker_registry = new gcp.artifactregistry.Repository(
  "docker-registry",
  {
    description: "Repository for container images used in this project",
    // dockerConfig: { immutableTags: true },
    format: "DOCKER",
    labels: { customer: "personal" },
    location: "europe-west8",
    repositoryId: "docker-registry",
  }
);

const frontend_path = path.join(
  repo_root,
  "packages",
  "sse-frontend",
  "public"
);

const synced_folder = new synced.GoogleCloudFolder("synced-folder", {
  bucketName: frontend_bucket.name,
  path: frontend_path,
});

// Create an IAM binding to allow public read access to the bucket.
const frontend_bucket_IAM_binding = new gcp.storage.BucketIAMBinding(
  "frontend-bucket-iam-binding",
  {
    bucket: frontend_bucket.name,
    role: "roles/storage.objectViewer",
    members: ["allUsers"],
  }
);

// https://www.pulumi.com/registry/packages/docker/api-docs/image/
export const sse_backend_image = new docker.Image("sse-backend-image", {
  // In order to push container images to Artifact Registry, we need to configure
  // the gcloud Docker credential helper.
  // gcloud auth configure-docker europe-west8-docker.pkg.dev
  // https://cloud.google.com/artifact-registry/docs/docker/authentication
  imageName: pulumi.interpolate`${docker_registry.location}-docker.pkg.dev/${project}/${docker_registry.name}/sse-backend:v0.1.0`,
  build: {
    platform: "linux/amd64",
    args: { APP_NAME: "sse-backend" },
    context: "./packages/sse-backend",
  },
});

export const sse_backend_service = new gcp.cloudrunv2.Service(
  "sse-backend",
  {
    location: worker_location,
    template: {
      containers: [
        {
          envs: [{ name: "NODE_ENV", value: "production" }],
          image: sse_backend_image.id,
          resources: {
            cpuIdle: true,
            limits: { cpu: "1000m", memory: "512Mi" },
            startupCpuBoost: false,
          },
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
  },
  { dependsOn: [enable_cloud_run] }
);

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

// Create a JSON file containing the backend URL. Host it on the site's bucket.
export const frontend_config = new gcp.storage.BucketObject("frontend-config", {
  name: "config.json",
  // cacheControl: "public, max-age=10",
  cacheControl: "no-store",
  source: enqueuer.httpsTriggerUrl.apply(
    (url) =>
      new pulumi.asset.StringAsset(
        JSON.stringify({ api: url, sse_endpoint: "http://127.0.0.1:4000/sse" })
      )
  ),
  contentType: "application/json",
  bucket: frontend_bucket.name,
});

// Export the URLs of the website and serverless endpoint.
export const site_url = pulumi.interpolate`https://storage.googleapis.com/${frontend_bucket.name}/index.html`;
export const api_url = enqueuer.httpsTriggerUrl;

const project_policy = gcp.projects.getIamPolicyOutput({ project });

// I think it's always a good idea to show the GCP project IAM bindings in the
// dashboard of the Pulumi Stack.
export const project_iam_bindings = project_policy.policyData.apply(
  (d) => JSON.parse(d).bindings
);

// export const publicly_accessible_services = {
//   enqueuer: enqueuer.httpsTriggerUrl,
//   enqueuer_2nd_gen: enqueuer_2nd_gen.url,
//   worker: worker.uri,
// };
