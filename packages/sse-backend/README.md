# sse-backend

Server-sent events backend.

## Development

### Non-containerized application

Start the application on port `4000` (or on the environment variable `PORT`):

```sh
npm run start -w sse-backend
```

*Note*: no need to build the app because I am using [tsm](https://github.com/lukeed/tsm).

### Containerized application

Build the container image:

```sh
npm run container:build -w sse-backend
```

Start the application:

```sh
docker run -it --rm -p 8080:8080 \
  --env NODE_ENV=production \
  --env PORT=8080 \
  sse-backend:latest
```

## Test

```sh
curl -X GET $SSE_BACKEND \
  -H "Authorization: bearer $(gcloud auth print-identity-token)" \
  -H "Content-Type: application/json" | jq
```
