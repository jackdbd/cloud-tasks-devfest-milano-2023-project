import * as path from 'node:path'
import * as pulumi from '@pulumi/pulumi'
import * as docker from '@pulumi/docker'
import * as gcp from '@pulumi/gcp'
import {
  events_server_location,
  events_server_name,
  project,
  repo_root
} from './constants'
import { sa_events_server } from './service-accounts'
import { docker_registry } from './repositories'
import { enable_cloud_run } from './services'

const events_server_context = path.join(repo_root, 'packages', 'events-server')

const events_server_image = new docker.Image('events-server-image', {
  // In order to push container images to Artifact Registry, we need to configure
  // the gcloud Docker credential helper.
  // gcloud auth configure-docker europe-west8-docker.pkg.dev
  // https://cloud.google.com/artifact-registry/docs/docker/authentication
  // TODO: create a docker tag at every push?
  imageName: pulumi.interpolate`${docker_registry.location}-docker.pkg.dev/${project}/${docker_registry.name}/${events_server_name}:v0.1.0`,
  build: {
    platform: 'linux/amd64',
    args: { APP_NAME: events_server_name },
    context: events_server_context
  }
})

export const events_service = new gcp.cloudrunv2.Service(
  events_server_name,
  {
    location: events_server_location,
    name: events_server_name,
    template: {
      containers: [
        {
          envs: [{ name: 'NODE_ENV', value: 'production' }],
          image: events_server_image.id,
          resources: {
            // Since Server Sent Event are server side, pushing changes to the
            // client won't work, unless you have CPU allocated.
            // https://www.googlecloudcommunity.com/gc/Serverless/Server-Sent-Events-on-Cloud-Run-not-working/td-p/609896
            // https://cloud.google.com/run/docs/configuring/cpu-allocation
            // cpuIdle: false,
            cpuIdle: true,
            limits: { cpu: '1000m', memory: '512Mi' },
            startupCpuBoost: false
          }
          // livenessProbe: {},
          // startupProbe: {
          //   failureThreshold: 3,
          //   initialDelaySeconds: 1,
          //   periodSeconds: 240,
          //   tcpSocket: { port: 8080 },
          //   timeoutSeconds: 10
          // }
        }
      ],
      maxInstanceRequestConcurrency: 10,
      timeout: '60s',
      serviceAccount: sa_events_server.email,
      scaling: { maxInstanceCount: 1, minInstanceCount: 0 }
    },
    traffics: [{ percent: 100, type: 'TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST' }]
  },
  { dependsOn: [enable_cloud_run] }
)
