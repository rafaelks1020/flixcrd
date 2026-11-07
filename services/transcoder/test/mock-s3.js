import http from "node:http";
import crypto from "node:crypto";

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Servidor S3 falso em memoria (path-style) compativel com @aws-sdk/client-s3 e @aws-sdk/lib-storage.
 */
export async function startMockS3Server() {
  const objects = new Map();
  const multiparts = new Map();

  const makeKey = (bucket, key) => `${bucket}/${key}`;

  const server = http.createServer(async (req, res) => {
    try {
      const parsed = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
      const segments = parsed.pathname.replace(/^\/+/, "").split("/");
      const bucket = decodeURIComponent(segments[0] || "");
      const key = segments
        .slice(1)
        .map((s) => decodeURIComponent(s))
        .join("/");

      const method = req.method || "GET";
      const storeKey = makeKey(bucket, key);

      if (method === "GET" && key) {
        const entry = objects.get(storeKey);
        if (!entry) {
          const xml = `<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code><Message>Key not found</Message></Error>`;
          res.writeHead(404, { "Content-Type": "application/xml" });
          res.end(xml);
          return;
        }
        res.writeHead(200, {
          "Content-Type": entry.contentType || "application/octet-stream",
          "Content-Length": entry.body.length,
          ETag: entry.etag,
        });
        res.end(entry.body);
        return;
      }

      if (method === "HEAD" && key) {
        const entry = objects.get(storeKey);
        if (!entry) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, {
          "Content-Type": entry.contentType || "application/octet-stream",
          "Content-Length": entry.body.length,
          ETag: entry.etag,
        });
        res.end();
        return;
      }

      if (method === "PUT" && key) {
        const body = await readBuffer(req);
        const uploadId = parsed.searchParams.get("uploadId");
        const partNumberRaw = parsed.searchParams.get("partNumber");

        if (uploadId && partNumberRaw) {
          const mp = multiparts.get(uploadId);
          if (!mp) {
            res.writeHead(404);
            res.end();
            return;
          }
          const partNumber = Number.parseInt(partNumberRaw, 10);
          mp.parts.set(partNumber, body);
          const etag = `"${crypto.createHash("md5").update(body).digest("hex")}"`;
          res.writeHead(200, { ETag: etag });
          res.end();
          return;
        }

        const etag = `"${crypto.createHash("md5").update(body).digest("hex")}"`;
        objects.set(storeKey, {
          bucket,
          key,
          body,
          contentType: req.headers["content-type"] || "application/octet-stream",
          etag,
        });
        res.writeHead(200, { ETag: etag });
        res.end();
        return;
      }

      if (method === "POST" && key) {
        if (parsed.searchParams.has("uploads")) {
          const uploadId = crypto.randomUUID();
          multiparts.set(uploadId, {
            bucket,
            key,
            contentType: req.headers["content-type"] || "application/octet-stream",
            parts: new Map(),
          });
          const xml = `<?xml version="1.0" encoding="UTF-8"?><InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Bucket>${escapeXml(bucket)}</Bucket><Key>${escapeXml(key)}</Key><UploadId>${uploadId}</UploadId></InitiateMultipartUploadResult>`;
          res.writeHead(200, { "Content-Type": "application/xml" });
          res.end(xml);
          return;
        }

        const uploadId = parsed.searchParams.get("uploadId");
        if (uploadId) {
          await readBuffer(req);
          const mp = multiparts.get(uploadId);
          if (!mp) {
            res.writeHead(404);
            res.end();
            return;
          }
          const orderedBuffers = Array.from(mp.parts.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, buf]) => buf);
          const combined = Buffer.concat(orderedBuffers);
          const etag = `"${crypto.createHash("md5").update(combined).digest("hex")}"`;
          objects.set(makeKey(mp.bucket, mp.key), {
            bucket: mp.bucket,
            key: mp.key,
            body: combined,
            contentType: mp.contentType,
            etag,
          });
          multiparts.delete(uploadId);
          const xml = `<?xml version="1.0" encoding="UTF-8"?><CompleteMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Bucket>${escapeXml(mp.bucket)}</Bucket><Key>${escapeXml(mp.key)}</Key><ETag>${etag}</ETag></CompleteMultipartUploadResult>`;
          res.writeHead(200, { "Content-Type": "application/xml" });
          res.end(xml);
          return;
        }
      }

      if (method === "DELETE" && key) {
        const uploadId = parsed.searchParams.get("uploadId");
        if (uploadId) {
          multiparts.delete(uploadId);
          res.writeHead(204);
          res.end();
          return;
        }
        objects.delete(storeKey);
        res.writeHead(204);
        res.end();
        return;
      }

      res.writeHead(404);
      res.end();
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const endpoint = `http://127.0.0.1:${address.port}`;

  return {
    endpoint,
    putObject(bucket, key, body, contentType = "application/octet-stream") {
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
      const etag = `"${crypto.createHash("md5").update(buf).digest("hex")}"`;
      objects.set(makeKey(bucket, key), { bucket, key, body: buf, contentType, etag });
    },
    getObject(bucket, key) {
      return objects.get(makeKey(bucket, key)) ?? null;
    },
    hasObject(bucket, key) {
      return objects.has(makeKey(bucket, key));
    },
    listKeys(bucket, prefix = "") {
      const result = [];
      for (const item of objects.values()) {
        if (item.bucket === bucket && item.key.startsWith(prefix)) {
          result.push(item.key);
        }
      }
      return result.sort();
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
