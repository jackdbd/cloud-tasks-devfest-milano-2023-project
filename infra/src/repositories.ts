import * as gcp from "@pulumi/gcp";
import { enable_artifact_registry } from "./services";

// https://www.pulumi.com/registry/packages/gcp/api-docs/artifactregistry/repository/
export const docker_registry = new gcp.artifactregistry.Repository(
  "docker-registry",
  {
    // cleanupPolicies: [],
    description: "Repository for container images used in this project",
    // dockerConfig: { immutableTags: true },
    format: "DOCKER",
    labels: { customer: "personal" },
    location: "europe-west8",
    repositoryId: "docker-registry",
  },
  { dependsOn: [enable_artifact_registry] }
);
