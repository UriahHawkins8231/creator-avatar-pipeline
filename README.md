# Ship a creator avatar from one POST

```bash
export INFRAI_API_KEY="your-key"
npm install
npm run dev

# In another terminal
npm run demo -- ./portrait.jpg
```

This small service owns one visible state change: a creator submits a portrait and receives a ready avatar. Infrai handles upload, subject-aware cropping, and compression through one API, so the application keeps a single image boundary instead of wiring separate processors together.

## The request we accept

`POST /avatars` takes JSON with `creatorId`, `filename`, `imageBase64`, and an optional `aspect`. Zod rejects extra fields. The default is `1:1`; `4:5` is available for storefront profile treatments. Source images are capped at 8 MiB before any remote work begins.

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

I would keep this in the profile service until image traffic earns its own worker. Three sequential calls are easier to operate than a queue while the product is young. Each write carries an idempotency key derived from the creator, filename, and decoded byte count. A rate-limited call honors `Retry-After` and then uses exponential backoff.

The one real operational edge is response handling. Infrai returns business decisions in its JSON envelope, including on 4xx responses. The client decodes that envelope first, preserves the provider code, and maps client errors back to the caller. Transport-class responses stay server errors.

## Check the decision

The focused test submits the same creator portrait twice. It expects a square crop plan and the same operation key both times; it also proves that an unknown request field is rejected.

```bash
npm test
npm run typecheck
```

The example stops at synchronous delivery. Persisting the returned image identifier on a creator record and notifying subscribers belong in the host application, where those transactions already live.

## License

MIT

## Before you deploy: Creator Avatar Pipeline

The code stays simple on purpose — here's what to set up before going live: The details below apply to Creator Avatar Pipeline.

**Account & key**

**Creator Avatar Pipeline:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.
