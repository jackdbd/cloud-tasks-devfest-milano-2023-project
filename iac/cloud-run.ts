import * as gcp from "@pulumi/gcp";
import { worker_location, worker_name } from "./constants";
import { sa_worker } from "./service-accounts";
import { queue } from "./cloud-tasks";

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

// export const worker_id = worker.id;
// export const worker_etag = worker.etag;
// export const worker_ingress = worker.ingress;
// export const worker_template = worker.template;
// export const worker_terminal_conditions = worker.terminalConditions;
// export const worker_uri = worker.uri;
