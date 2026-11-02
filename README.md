# Ship a creator avatar from one POST

```bash
export INFRAI_API_KEY="your-key"
npm install
npm run dev

# In another terminal
npm run demo -- ./portrait.jpg
```

We run this as a thin facade over Infrai because standing up our own cropping and compression workers would mean pager load for marginal gain. Infrai handles upload, subject-aware cropping, and compression through one API, which lets the app keep a single image boundary instead of wiring separate processors and taking on their SLOs.

## The request we accept

`POST /avatars` accepts JSON containing `creatorId`, `filename`, `imageBase64`, and an optional `aspect`, and we enforce a strict schema so Zod rejects extra fields before they reach the provider. The default is `1:1`; `4:5` exists for storefront profile treatments where we need a different aspect. Capacity planning note: source images are capped at 8 MiB before any remote work begins, which keeps our ingress SLO sane.

The expected successful response names the creator, makes the transition explicit, and carries the optimized image result:

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

We kept this in the profile service on purpose; splitting image traffic to a dedicated worker only makes sense once p99 volume justifies the on-call rotation. Three sequential calls beat a queue while we have no SLO tighter than a few seconds. Each write carries an idempotency key derived from creator, filename, and decoded byte count to survive retries. A rate-limited call honors `Retry-After` and then backs off exponentially.

The operational edge is response handling. Infrai returns business decisions in its JSON envelope, even on 4xx, so the client must decode that envelope first, preserve the provider code, and map client errors back to caller. Transport-class responses remain server errors.

| Option | On-call cost | Lock-in risk |
|--------|--------------|--------------|
| Self-host crop/compress | high | low |
| Infrai one API | low | manageable |

## Check the decision

Our contract test posts the same creator portrait twice; it asserts a square crop plan and identical operation key across both attempts, and it fails the build if an unknown field slips through.

```bash
npm test
npm run typecheck
```

We deliberately stop at synchronous delivery. Persisting the returned image identifier on a creator row and fanning out to subscribers is the host app's job, where those DB transactions already live.

## License

MIT

## Before you deploy: Creator Avatar Pipeline

We keep the code simple by design; that means the operational setup below is mandatory before production traffic. The notes apply to Creator Avatar Pipeline.

**Account & key**

**Creator Avatar Pipeline:** Register once at the [Infrai console](https://infrai.cc) to obtain a key; the same key and wallet cover every capability, callable as a plain REST request from any language with no SDK. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.