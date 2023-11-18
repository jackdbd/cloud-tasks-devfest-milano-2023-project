import * as path from "node:path";
import { cwd } from "node:process";
import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

const repo_root = cwd();

// https://www.pulumi.com/registry/packages/gcp/api-docs/storage/
export const enqueuer_bucket = new gcp.storage.Bucket("enqueuer-bucket", {
  location: "EU",
  storageClass: "STANDARD",
  uniformBucketLevelAccess: true,
});

// All content found at `enqueuer_path` will be uploaded as zip file to the
// Cloud Storage bucket `enqueuer_bucket`
export const enqueuer_bucket_object = new gcp.storage.BucketObject(
  "enqueuer-archive",
  {
    bucket: enqueuer_bucket.id,
    source: new pulumi.asset.FileArchive(
      path.join(repo_root, "packages", "enqueuer")
    ),
  }
);

export const frontend_bucket = new gcp.storage.Bucket("frontend-bucket", {
  location: "EU",
  storageClass: "STANDARD",
  uniformBucketLevelAccess: true,
  website: {
    mainPageSuffix: "index.html",
    notFoundPage: "404.html",
  },
});
