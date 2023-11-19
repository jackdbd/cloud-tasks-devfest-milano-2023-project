import * as path from "node:path";
import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as gcp from "@pulumi/gcp";
import { project, repo_root, worker_location, worker_name } from "./constants";
import { sa_worker } from "./service-accounts";
import { queue } from "./cloud-tasks";
import { docker_registry } from "./repositories";
import { enable_cloud_run } from "./services";

// https://www.pulumi.com/registry/packages/gcp/api-docs/cloudrunv2/
export const worker = new gcp.cloudrunv2.Service(
  worker_name,
  {
    description:
      "Service that processes the tasks dispatched by a Cloud Tasks queue",
    ingress: "INGRESS_TRAFFIC_ALL",
    location: worker_location,
    template: {
      containers: [
        {
          envs: [{ name: "THE_ANSWER", value: "42" }],
          image: "us-docker.pkg.dev/cloudrun/container/hello",
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
    traffics: [{ percent: 100, type: "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST" }],
  },
  { dependsOn: [queue] }
);

const worker_policy = gcp.cloudrunv2.getServiceIamPolicyOutput({
  location: worker_location,
  name: worker_name,
});

export const worker_iam_bindings = worker_policy.policyData.apply(
  (d) => JSON.parse(d).bindings
);

const sse_backend_context = path.join(repo_root, "packages", "sse-backend");

const sse_backend_image = new docker.Image("sse-backend-image", {
  // In order to push container images to Artifact Registry, we need to configure
  // the gcloud Docker credential helper.
  // gcloud auth configure-docker europe-west8-docker.pkg.dev
  // https://cloud.google.com/artifact-registry/docs/docker/authentication
  // TODO: create a docker tag at every push?
  imageName: pulumi.interpolate`${docker_registry.location}-docker.pkg.dev/${project}/${docker_registry.name}/sse-backend:v0.1.0`,
  build: {
    platform: "linux/amd64",
    args: { APP_NAME: "sse-backend" },
    context: sse_backend_context,
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
