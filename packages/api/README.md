# API

todo

```sh
curl -X POST "$API/" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{
    \"events_endpoint\": \"$EVENTS_ENDPOINT\",
    \"task_id\": \"some-task-id\"
  }" | jq
```

```sh
curl --max-time 30 -X POST "$API/" \
  -H "Authorization: bearer $(gcloud auth print-identity-token)" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "X-Task-Enqueued-By: curl" \
  -d "{
    \"events_endpoint\": \"$EVENTS_ENDPOINT\",
    \"task_id\": \"some-task-id\"
  }" | jq
```
