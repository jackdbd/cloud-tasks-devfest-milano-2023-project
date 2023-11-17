# DevFest Milano 2023

## Pre-requisites

Enable the necessary Google Cloud services either using the web console, gcloud, or the Service Usage API. See [here](https://cloud.google.com/service-usage/docs/enable-disable) for details.

- Cloud Build API
- Cloud Functions API
- Cloud Run API
- Cloud Tasks API

```sh
gcloud services enable cloudbuild.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable run.googleapis.com
```

You can use this command to check that all the necessary Google Cloud APIs are enabled.

```sh
gcloud services list --enabled
```

## Deploy the updates

```sh
npm run deploy
```
