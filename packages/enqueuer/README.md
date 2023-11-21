# enqueuer

todo

```sh
curl --max-time 5 -X POST "$ENQUEUER/" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{
    \"events_endpoint\": \"$EVENTS_ENDPOINT\",
    \"location\": \"europe-west3\",
    \"project\": \"devfest-milano-2023\",
    \"queue\": \"my-queue\",
    \"url\": \"$API/\"
  }" | jq
```

```sh
curl --max-time 5 -X POST "$ENQUEUER_2ND_GEN/" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{
    \"events_endpoint\": \"$EVENTS_ENDPOINT\",
    \"project\": \"devfest-milano-2023\",
    \"location\": \"europe-west3\",
    \"queue\": \"my-queue\",
    \"url\": \"$API/\"
  }" | jq
```
