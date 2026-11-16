import { createServer } from "node:http";

import { RenderRequestSchema } from "../../src/schemas/render";
import type { RenderRequest } from "../../src/types/render";
import { renderFlyer } from "./engine/render";

const port = Number(process.env.RENDER_WORKER_PORT ?? 4100);
const secret = process.env.RENDER_WORKER_SECRET;

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readBody(request: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    send(response, 200, { ok: true });
    return;
  }

  if (request.method !== "POST" || request.url !== "/render") {
    send(response, 404, { ok: false, error: "Not found." });
    return;
  }

  if (!secret || request.headers["x-render-worker-secret"] !== secret) {
    send(response, 401, { ok: false, error: "Unauthorized." });
    return;
  }

  try {
    const parsed = RenderRequestSchema.safeParse(JSON.parse(await readBody(request)));
    if (!parsed.success) {
      send(response, 400, {
        ok: false,
        warnings: [],
        errors: [{ code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message ?? "Request is invalid.", severity: "error" }],
        metrics: { durationMs: 0, minFontSizeUsed: 0 },
      });
      return;
    }

    const result = await renderFlyer(parsed.data as RenderRequest, { output: parsed.data.fileType ?? "png" });
    const publicResult = { jobId: parsed.data.jobId, ok: result.ok, warnings: result.warnings, errors: result.errors, metrics: result.metrics };
    send(response, result.ok && result.outputBuffer ? 200 : 422, { ...publicResult, outputBase64: result.outputBuffer?.toString("base64") });
  } catch (error) {
    send(response, 400, { ok: false, errors: [{ code: "INVALID_REQUEST", message: error instanceof Error ? error.message : "Request is invalid.", severity: "error" }], warnings: [], metrics: { durationMs: 0, minFontSizeUsed: 0 } });
  }
});

server.listen(port, () => console.log(`Render worker listening on http://localhost:${port}`));
