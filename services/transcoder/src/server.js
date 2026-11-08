import http from "node:http";
import {
  ValidationError,
  verifyBearerToken,
  validateSourceKey,
  validateDestPrefix,
  validateBucketName,
  validateCrf,
} from "./security.js";

const MAX_BODY_BYTES = 64 * 1024;

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, {
    error: message,
    detail: message,
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        req.destroy();
        reject(new ValidationError("Corpo da requisicao excede o limite permitido."));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString("utf-8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          reject(new ValidationError("Corpo JSON deve ser um objeto."));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new ValidationError("JSON malformado no corpo da requisicao."));
      }
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

function textField(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function requireWorkerId(body) {
  const workerId = textField(body.worker_id, 128);
  if (!workerId) {
    throw new ValidationError("Campo worker_id e obrigatorio.");
  }
  return workerId;
}

function conflictOrNotFound(res, outcome) {
  if (outcome === "notfound") {
    sendError(res, 404, "Job nao encontrado.");
  } else {
    sendError(res, 409, "O job nao esta mais com este trabalhador.");
  }
}

async function handleWorkerRoute({ req, res, method, pathname, queue }) {
  if (method !== "POST") {
    sendError(res, 404, "Rota nao encontrada.");
    return;
  }

  if (pathname === "/worker/heartbeat") {
    const body = await readJsonBody(req);
    const workerId = requireWorkerId(body);
    const jobId = textField(body.job_id, 128) || null;
    const result = queue.heartbeat({
      workerId,
      name: body.name,
      gpu: body.gpu,
      encoder: body.encoder,
      version: body.version,
      jobId,
    });
    sendJson(res, 200, result);
    return;
  }

  if (pathname === "/worker/claim") {
    const body = await readJsonBody(req);
    const workerId = requireWorkerId(body);
    const job = await queue.claimJob(workerId);
    if (!job) {
      res.writeHead(204, { "Cache-Control": "no-store" });
      res.end();
      return;
    }
    sendJson(res, 200, { job });
    return;
  }

  const match = pathname.match(/^\/worker\/jobs\/([^/]+)\/(progress|complete|fail)$/);
  if (!match) {
    sendError(res, 404, "Rota nao encontrada.");
    return;
  }

  let jobId;
  try {
    jobId = decodeURIComponent(match[1]);
  } catch {
    sendError(res, 400, "Identificador de job invalido.");
    return;
  }

  const body = await readJsonBody(req);
  const workerId = requireWorkerId(body);

  let outcome;
  if (match[2] === "progress") {
    outcome = queue.workerProgress({
      workerId,
      jobId,
      progress: typeof body.progress === "number" ? body.progress : Number.NaN,
      message: body.message,
      telemetry: body.telemetry,
    });
  } else if (match[2] === "complete") {
    outcome = await queue.workerComplete({
      workerId,
      jobId,
      renditions: Array.isArray(body.renditions) ? body.renditions.slice(0, 20) : [],
      subtitles: Array.isArray(body.subtitles) ? body.subtitles.slice(0, 100) : [],
    });
  } else {
    outcome = await queue.workerFail({ workerId, jobId, error: body.error });
  }

  if (outcome !== "ok") {
    conflictOrNotFound(res, outcome);
    return;
  }
  sendJson(res, 200, { ok: true });
}

/**
 * Cria o servidor HTTP do servico de conversao HLS.
 */
export function createTranscoderServer({ config, queue }) {
  const server = http.createServer(async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const method = req.method || "GET";
      const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";

      // Endpoints do trabalhador remoto: token proprio; sem token configurado a rota nao existe.
      if (pathname.startsWith("/worker/")) {
        if (!config.workerToken) {
          sendError(res, 404, "Rota nao encontrada.");
          return;
        }
        if (!verifyBearerToken(authHeader, config.workerToken)) {
          sendError(res, 401, "Nao autorizado. Header Authorization Bearer obrigatorio.");
          return;
        }
        await handleWorkerRoute({ req, res, method, pathname, queue });
        return;
      }

      if (!verifyBearerToken(authHeader, config.token)) {
        sendError(res, 401, "Nao autorizado. Header Authorization Bearer obrigatorio.");
        return;
      }

      // GET /workers
      if (method === "GET" && pathname === "/workers") {
        sendJson(res, 200, { workers: queue.listWorkers() });
        return;
      }

      // GET /health (tambem autenticada conforme regra de seguranca)
      if (method === "GET" && pathname === "/health") {
        sendJson(res, 200, { ok: true });
        return;
      }

      // GET /jobs
      if (method === "GET" && pathname === "/jobs") {
        sendJson(res, 200, queue.listJobs());
        return;
      }

      // GET /jobs/:id
      const jobMatch = pathname.match(/^\/jobs\/([^/]+)$/);
      if (method === "GET" && jobMatch) {
        let jobId;
        try {
          jobId = decodeURIComponent(jobMatch[1]);
        } catch {
          sendError(res, 400, "Identificador de job invalido.");
          return;
        }

        if (jobId === "hls") {
          sendError(res, 405, "Metodo nao permitido para /jobs/hls.");
          return;
        }

        const job = queue.getJob(jobId);
        if (!job) {
          sendError(res, 404, "Job nao encontrado.");
          return;
        }

        sendJson(res, 200, job);
        return;
      }

      // POST /jobs/hls
      if (method === "POST" && pathname === "/jobs/hls") {
        const body = await readJsonBody(req);

        const bucket = validateBucketName(body.bucket ?? config.s3.defaultBucket);
        const sourceKey = validateSourceKey(body.source_key ?? body.sourceKey);
        const destPrefix = validateDestPrefix(body.dest_prefix ?? body.destPrefix);
        const crf = validateCrf(body.crf, 20);
        const deleteSource = Boolean(body.delete_source ?? body.deleteSource ?? false);

        const titleId =
          typeof (body.title_id ?? body.titleId) === "string"
            ? String(body.title_id ?? body.titleId).trim() || null
            : null;
        const episodeId =
          typeof (body.episode_id ?? body.episodeId) === "string"
            ? String(body.episode_id ?? body.episodeId).trim() || null
            : null;

        const created = await queue.enqueue({
          bucket,
          sourceKey,
          destPrefix,
          crf,
          deleteSource,
          titleId,
          episodeId,
        });

        sendJson(res, 202, created);
        return;
      }

      sendError(res, 404, "Rota nao encontrada.");
    } catch (err) {
      if (err instanceof ValidationError) {
        sendError(res, err.statusCode || 400, err.message);
        return;
      }
      console.error("[Transcoder] Erro interno na requisicao HTTP:", err);
      sendError(res, 500, "Erro interno no servico de transcodificacao.");
    }
  });

  return server;
}
