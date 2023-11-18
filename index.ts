import * as path from "node:path";
import { cwd } from "node:process";
import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as synced from "@pulumi/synced-folder";
import { project, enqueuer_location, worker_location } from "./iac/constants";
import { enqueuer, enqueuer_2nd_gen } from "./iac/cloud-functions";
import { sse_backend_service, worker } from "./iac/cloud-run";
import { frontend_bucket } from "./iac/cloud-storage";

const repo_root = cwd();

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

const frontend_bucket_IAM_binding = new gcp.storage.BucketIAMBinding(
  "frontend-bucket-iam-binding",
  {
    bucket: frontend_bucket.name,
    role: "roles/storage.objectViewer",
    members: ["allUsers"],
  }
);

export const enqueuer_cloudfunctions_invoker =
  new gcp.cloudfunctions.FunctionIamMember("enqueuer-cloudfunctions-invoker", {
    cloudFunction: enqueuer.name,
    member: "allUsers",
    region: enqueuer_location,
    role: "roles/cloudfunctions.invoker",
  });

export const sse_backend_run_invoker = new gcp.cloudrunv2.ServiceIamMember(
  "sse-backend-run-invoker",
  {
    location: worker_location,
    member: "allUsers",
    name: sse_backend_service.name,
    role: "roles/run.invoker",
  }
);

// Create a JSON file containing all backend URLs and host it on the same bucket
// where it is hosted the frontend.
const config_json_hosted = new gcp.storage.BucketObject(
  "config-json-hosted",
  {
    bucket: frontend_bucket.name,
    // cacheControl: "public, max-age=10",
    cacheControl: "no-store",
    contentType: "application/json",
    name: "config.json",
    source: pulumi
      .all([enqueuer.httpsTriggerUrl, sse_backend_service.uri])
      .apply(([enqueuer_url, sse_endpoint]) => {
        return new pulumi.asset.StringAsset(
          JSON.stringify({ api: enqueuer_url, sse_endpoint })
        );
      }),
  },
  { dependsOn: [enqueuer, sse_backend_service] }
);

const project_policy = gcp.projects.getIamPolicyOutput({ project });

// I think it's always a good idea to show the GCP project IAM bindings in the
// dashboard of the Pulumi Stack.
export const project_iam_bindings = project_policy.policyData.apply(
  (d) => JSON.parse(d).bindings
);

export const services_url = {
  enqueuer: enqueuer.httpsTriggerUrl,
  enqueuer_2nd_gen: enqueuer_2nd_gen.url,
  sse_frontend: pulumi.interpolate`https://storage.googleapis.com/${frontend_bucket.name}/index.html`,
  sse_backend: sse_backend_service.uri,
  worker: worker.uri,
};
