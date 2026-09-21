import assert from "node:assert/strict";
import test from "node:test";
import { planAvatar } from "../src/avatar_policy.js";

test("the avatar plan fixes a square crop and a stable retry identity", () => {
  const request = {
    creatorId: "maya",
    filename: "headshot.jpg",
    imageBase64: Buffer.from("portrait bytes").toString("base64")
  };

  const first = planAvatar(request);
  const repeated = planAvatar(request);

  assert.equal(first.aspect, "1:1");
  assert.equal(first.operationKey, repeated.operationKey);
  assert.match(first.dataUrl, /^data:image\/jpeg;base64,/);
});

test("unknown request fields are rejected at the service boundary", () => {
  assert.throws(() => planAvatar({
    creatorId: "maya",
    filename: "headshot.jpg",
    imageBase64: "YQ==",
    audience: "subscribers"
  }));
});
