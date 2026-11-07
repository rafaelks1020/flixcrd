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

/**
 * Cria o servidor HTTP do servico de conversao HLS.
 */
export function createTranscoderServer({ config, queue }) {
  const server = http.createServer(async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!verifyBearerToken(authHeader, config.token)) {
        sendError(res, 401, "Nao autorizado. Header Authorization Bearer obrigatorio.");
        return;
      }

      const method = req.method || "GET";
      const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";

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
