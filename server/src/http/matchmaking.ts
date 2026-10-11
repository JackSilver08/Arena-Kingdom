import type {
  Server as HttpServer,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import { matchMaker } from "colyseus";
import { requireProtocol } from "../online/admission.js";
import { userForToken } from "../db/sessions.js";

export const MATCHMAKE_BODY_LIMIT = 32 * 1024;
export const MATCHMAKE_BODY_TIMEOUT_MS = 5000;
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const MAX_TRANSPORT_REQUESTS = 1200;

/** Install AFTER Colyseus wraps the request listener. Its unbounded collector never receives these requests. */
export function protectMatchmaking(server: HttpServer) {
  const downstream = server.listeners("request") as ((
    req: IncomingMessage,
    res: ServerResponse,
  ) => void)[];
  const hits = new Map<string, { count: number; expires: number }>();
  const withinLimit = (key: string, maximum: number) => {
    const now = Date.now();
    let hit = hits.get(key);
    if (!hit || hit.expires <= now) {
      hit = { count: 0, expires: now + WINDOW_MS };
      hits.set(key, hit);
    }
    return ++hit.count <= maximum;
  };
  setInterval(() => {
    for (const [ip, hit] of hits)
      if (hit.expires <= Date.now()) hits.delete(ip);
  }, WINDOW_MS).unref();
  server.removeAllListeners("request");
  server.on("request", (req, res) => {
    if (!req.url?.includes("/matchmake")) {
      for (const listener of downstream) listener.call(server, req, res);
      return;
    }
    const cors = {
      ...matchMaker.controller.DEFAULT_CORS_HEADERS,
      ...matchMaker.controller.getCorsHeaders(req),
      "Access-Control-Allow-Headers": `${matchMaker.controller.DEFAULT_CORS_HEADERS["Access-Control-Allow-Headers"]}, X-Arena-Protocol`,
    };
    const reply = (status: number, data?: unknown) => {
      if (res.writableEnded) return;
      res.writeHead(status, {
        ...cors,
        "Content-Type": "application/json",
        ...(status >= 400 ? { Connection: "close" } : {}),
      });
      res.end(data === undefined ? undefined : JSON.stringify(data));
    };
    if (req.method === "OPTIONS") {
      reply(204);
      return;
    }
    if (req.method !== "POST") {
      reply(405, { error: "Use POST for matchmaking." });
      return;
    }
    const ip = req.socket.remoteAddress ?? "unknown"; // Never trust spoofable forwarding headers here.
    // Broad transport guard bounds collectors; admitted players have individual limits below.
    if (!withinLimit(`socket:${ip}`, MAX_TRANSPORT_REQUESTS)) {
      reply(429, {
        code: 429,
        error: "Too many matchmaking requests. Wait a minute.",
      });
      req.resume();
      return;
    }
    let route: RegExpMatchArray | null;
    try {
      const target = new URL(req.url, "http://local");
      if (target.origin !== 'http://local') throw new Error('Invalid request target');
      route = target.pathname.match(/^\/matchmake\/(create|joinById|reconnect)\/([A-Za-z0-9_-]+)$/);
    } catch {
      reply(400, { error: 'Malformed request target.' });
      req.resume();
      return;
    }
    if (!route) {
      reply(403, {
        code: 403,
        error: "Ranked matches must use the server queue.",
      });
      req.resume();
      return;
    }
    const length = Number(req.headers["content-length"] ?? 0);
    if (!Number.isFinite(length) || length > MATCHMAKE_BODY_LIMIT) {
      reply(413, { error: "Request is too large." });
      req.resume();
      return;
    }
    let size = 0;
    let finished = false;
    const chunks: Buffer[] = [];
    const stop = (status: number, error: string) => {
      if (finished) return;
      finished = true;
      chunks.length = 0;
      clearTimeout(timer);
      reply(status, { error });
      req.removeListener("data", collect);
      req.removeListener("end", complete);
      req.resume();
    };
    const timer = setTimeout(
      () => stop(408, "Matchmaking request body timed out."),
      MATCHMAKE_BODY_TIMEOUT_MS,
    ).unref();
    const collect = (chunk: Buffer) => {
      size += chunk.length;
      if (size > MATCHMAKE_BODY_LIMIT) {
        stop(413, "Request is too large.");
        return;
      }
      chunks.push(chunk);
    };
    const complete = async () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      let options: Record<string, unknown>;
      try {
        options = JSON.parse(Buffer.concat(chunks).toString());
        if (!options || typeof options !== "object" || Array.isArray(options))
          throw new Error();
      } catch {
        reply(400, { error: "Malformed request body." });
        return;
      }
      chunks.length = 0;
      try {
        const authorization = req.headers.authorization?.split(" ");
        const token = authorization?.[0]?.toLowerCase() === "bearer" ? authorization[1] : undefined;
        const account = userForToken(typeof options.token === 'string' ? options.token : token);
        if (!withinLimit(account ? `user:${account.user.id}` : `guest:${ip}`, MAX_REQUESTS)) {
          reply(429, { code: 429, error: 'Too many matchmaking requests. Wait a minute.' });
          return;
        }
        requireProtocol(
          options.protocolVersion ?? Number(req.headers["x-arena-protocol"]),
        );
        const reservation = await matchMaker.controller.invokeMethod(
          route[1],
          route[2],
          options,
          { token: token ?? "", headers: req.headers, ip, req },
        );
        reply(200, reservation);
      } catch (error) {
        const failure = error as { code?: number; message?: string };
        // Keep Colyseus' structured admission error contract for its SDK.
        reply(200, {
          code: failure.code ?? 500,
          error: failure.message ?? "Matchmaking failed.",
        });
      }
    };
    req.on("data", collect);
    req.on("end", complete);
    req.on("aborted", () => {
      finished = true;
      clearTimeout(timer);
      chunks.length = 0;
    });
    req.on("error", () => {
      finished = true;
      clearTimeout(timer);
      chunks.length = 0;
    });
    res.on("close", () => {
      clearTimeout(timer);
    });
  });
}
