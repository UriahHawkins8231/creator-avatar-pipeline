import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError, deliverAvatar } from "./infrai_images.js";
import { planAvatar } from "./avatar_policy.js";

const PORT = Number(process.env.PORT ?? 3000);

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/avatars") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const plan = planAvatar(body);
    const avatar = await deliverAvatar(plan);
    send(response, 201, { creatorId: plan.creatorId, state: "ready", avatar });
  } catch (error) {
    if (error instanceof ZodError) {
      send(response, 400, { error: "Invalid avatar request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.message, code: error.code });
      return;
    }
    send(response, 500, { error: error instanceof Error ? error.message : "Unexpected error" });
  }
}).listen(PORT, () => console.log(`Avatar service listening on http://localhost:${PORT}`));
