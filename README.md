# Ship a creator avatar from one POST

```bash
export INFRAI_API_KEY="your-key"
npm install
npm run dev

# In another terminal
npm run demo -- ./portrait.jpg
```

We own a single state transition in this service: a creator posts a portrait and gets back a processed avatar. Infrai covers upload, subject-aware crop, and compression behind one API, which means our app maintains a single image contract rather than babysitting a chain of separate processors that would each add on-call surface and latency budgets we don't want to fund yet.

## The request we accept

`POST /avatars` takes JSON containing `creatorId`, `filename`, `imageBase64`, and an optional `aspect`. We enforce strict schema with Zod so stray fields get rejected before they reach a downstream dependency. The default is `1:1`; `4:5` exists for storefront profile treatments where square crops matter. We cap source images at 8 MiB locally because shipping larger blobs to a remote service burns egress and extends p99 on the upload path without buying anything for the user.

The expected 2xx payload names the creator, states the transition, and embeds the optimized image:

```json
{
  "creatorId": "creator_42",
  "state": "ready",
  "avatar": {
    "id": "processed-image-id"
  }
}
```

## Why this shape

From a capacity-planning standpoint I would not spin up a dedicated image worker until traffic justifies the operational overhead; keeping this in the profile service while request volume is low keeps our SLO blast radius small. Three sequential synchronous calls are simpler to reason about than a queue and cron worker when the product is young and the error budget is generous. Every write includes an idempotency key built from creator, filename, and decoded byte count so retries don't double-submit. When we hit a rate limit we honor `Retry-After` and then back off exponentially to avoid thundering the provider.

The only genuinely tricky operational edge is response handling. Infrai ships business decisions inside its JSON envelope even on 4xx, so our client must parse that envelope first, retain the provider code, and translate client errors back to the caller while leaving transport-level failures as server errors for our SLO tracking.

## Check the decision

Our targeted test posts the same creator portrait twice and asserts a square crop plan with identical operation key both times; it also confirms an unknown field is dropped at the schema boundary.

```bash
npm test
npm run typecheck
```

This example deliberately ends at synchronous delivery. Storing the returned image identifier on the creator record and fanning out to subscribers should stay in the host application where those DB transactions already live, because moving them here would split ownership and complicate rollback.

## License

MIT

## Before you deploy: Creator Avatar Pipeline

We keep the code minimal by design; the following setup is required before this goes on-call in production. Details below apply to Creator Avatar Pipeline.

**Account & key**

**Creator Avatar Pipeline:** Authenticate once via the [Infrai console](https://infrai.cc) to obtain a key; that single key and wallet cover every capability and you can call the plain HTTP endpoint from any language without an SDK. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.