# enqueuer

todo

```sh
curl --max-time 5 -X POST "$ENQUEUER/" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{
    \"project\": \"devfest-milano-2023\",
    \"url\": \"$API/\",
    \"location\": \"europe-west3\",
    \"queue\": \"my-queue\"
  }" | jq
```

```sh
curl --max-time 5 -X POST "$ENQUEUER_2ND_GEN/" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{
    \"project\": \"devfest-milano-2023\",
    \"url\": \"$API/\",
    \"location\": \"europe-west3\",
    \"queue\": \"my-queue\"
  }" | jq
```
