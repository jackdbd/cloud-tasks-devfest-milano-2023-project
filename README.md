# DevFest Milano 2023

## Pre-requisites

Enable the necessary Google Cloud services either using the web console, gcloud, or the Service Usage API. See [here](https://cloud.google.com/service-usage/docs/enable-disable) for details.

- Artifact Registry API
- Cloud Build API
- Cloud Functions API
- Cloud Run API
- Cloud Tasks API

```sh
gcloud services enable artifactregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable cloudtasks.googleapis.com
```

You can use this command to check that all the necessary Google Cloud APIs are enabled.

```sh
gcloud services list --enabled
```

Retrieve the current IAM policy for the GCP project:

```sh
gcloud projects get-iam-policy $GCP_PROJECT_ID
```

```sh
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
--member="serviceAccount:${SA_ENQUEUER_EMAIL}" \
--role='roles/cloudtasks.enqueuer'
```
