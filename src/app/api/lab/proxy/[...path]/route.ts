import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";

const UPSTREAM_DEFAULT_HOST = "superflixapi.run";
const ALLOWED_HOSTS = new Set(["superflixapi.run", "superflixapi.mom"]);

function shouldRewrite(contentType: string) {
  const ct = contentType.toLowerCase();
  return (
    ct.includes("text/html") ||
    ct.includes("text/css") ||
    ct.includes("application/javascript") ||
    ct.includes("text/javascript")
  );
}

function injectBase(html: string, baseHref: string) {
  const injection = `\n<base href="${baseHref}" />\n`;

  if (html.includes("</head>")) {
    return html.replace("</head>", injection + "</head>");
  }

  return html + injection;
}

function rewriteText(body: string, origin: string) {
  const proxyDefault = `${origin}/api/lab/proxy`;
  const proxyHost = (host: string) => `${origin}/api/lab/proxy/__host/${host}`;

  let out = body;

  out = out.replaceAll("https://superflixapi.run", proxyHost("superflixapi.run"));
  out = out.replaceAll("http://superflixapi.run", proxyHost("superflixapi.run"));
  out = out.replaceAll("//superflixapi.run", proxyHost("superflixapi.run"));

  out = out.replaceAll("https://superflixapi.mom", proxyHost("superflixapi.mom"));
  out = out.replaceAll("http://superflixapi.mom", proxyHost("superflixapi.mom"));
  out = out.replaceAll("//superflixapi.mom", proxyHost("superflixapi.mom"));

  out = out.replace(
    /(href|src|action)=(["'])\/(?!api\/lab\/proxy\/)/g,
    `$1=$2/api/lab/proxy/`,
  );
  out = out.replace(/url\(\/(?!api\/lab\/proxy\/)/g, "url(/api/lab/proxy/");

  // fallback: caso apareçam links absolutos só com base origin
  out = out.replaceAll(`${origin}/api/lab/proxy/__host/${UPSTREAM_DEFAULT_HOST}`, proxyDefault);

  return out;
}

function stripHtmlCspMeta(html: string) {
  return html.replace(
    /<meta[^>]+http-equiv=["']Content-Security-Policy(?:-Report-Only)?["'][^>]*>\s*/gi,
    "",
  );
}

function buildResponseHeaders(upstreamRes: Response, contentType: string) {
  const headers = new Headers();
  upstreamRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      headers.append(key, value);
      return;
    }

    headers.set(key, value);
  });

  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "no-store");

  // Evitar que políticas do upstream quebrem execução/interação quando servimos via nosso domínio
  headers.delete("content-security-policy");
  headers.delete("content-security-policy-report-only");
  headers.delete("x-frame-options");
  headers.delete("cross-origin-embedder-policy");
  headers.delete("cross-origin-opener-policy");
  headers.delete("cross-origin-resource-policy");

  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("transfer-encoding");

  return headers;
}

async function handleProxy(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
) {
  const user = await getAuthUser(request);

  if (!user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const enabled = user.role === "ADMIN" || process.env.NEXT_PUBLIC_LAB_ENABLED === "true";

  if (!enabled) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { path } = await params;
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;

  let host = UPSTREAM_DEFAULT_HOST;
  let upstreamPath = path;

  if (path[0] === "__host") {
    host = path[1] || UPSTREAM_DEFAULT_HOST;
    upstreamPath = path.slice(2);
  }

  if (!ALLOWED_HOSTS.has(host)) {
    return NextResponse.json({ error: "Host não permitido." }, { status: 400 });
  }

  const upstreamUrl = new URL(`https://${host}/${upstreamPath.join("/")}`);
  upstreamUrl.search = url.search;

  const upstreamHeaders = new Headers();
  const passthrough = [
    "user-agent",
    "accept",
    "accept-language",
    "referer",
    "origin",
    "sec-fetch-dest",
    "sec-fetch-mode",
    "sec-fetch-site",
    "sec-fetch-user",
    "sec-ch-ua",
    "sec-ch-ua-mobile",
    "sec-ch-ua-platform",
    "upgrade-insecure-requests",
    "dnt",
    "pragma",
    "cache-control",
    "range",
    "if-none-match",
    "if-modified-since",
    "content-type",
  ];

  for (const name of passthrough) {
    const value = request.headers.get(name);
    if (value) upstreamHeaders.set(name, value);
  }

  // Forçar comportamento de iframe cross-site (o proxy é same-origin, mas o upstream espera cross-site)
  upstreamHeaders.set("sec-fetch-dest", "iframe");
  upstreamHeaders.set("sec-fetch-mode", "navigate");
  upstreamHeaders.set("sec-fetch-site", "cross-site");
  upstreamHeaders.set("sec-fetch-user", "?1");
  upstreamHeaders.set("upgrade-insecure-requests", "1");

  if (!upstreamHeaders.get("user-agent")) {
    upstreamHeaders.set(
      "user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
  }

  // Se o browser não enviar referer (alguns cenários), garante um valor.
  if (!upstreamHeaders.get("referer")) {
    upstreamHeaders.set("referer", origin + "/");
  }

  const upstreamInit: RequestInit = {
    method: request.method,
    headers: upstreamHeaders,
    redirect: "follow",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const buf = await request.arrayBuffer();
    upstreamInit.body = buf;
  }

  const upstreamRes = await fetch(upstreamUrl.toString(), upstreamInit);

  const contentType = upstreamRes.headers.get("content-type") || "application/octet-stream";

  if (shouldRewrite(contentType)) {
    const raw = await upstreamRes.text();
    let rewritten = rewriteText(raw, origin);

    if (contentType.toLowerCase().includes("text/html")) {
      rewritten = stripHtmlCspMeta(rewritten);
    }

    const baseHref =
      host === UPSTREAM_DEFAULT_HOST
        ? "/api/lab/proxy/"
        : `/api/lab/proxy/__host/${host}/`;

    if (contentType.toLowerCase().includes("text/html")) {
      rewritten = injectBase(rewritten, baseHref);
    }

    return new NextResponse(rewritten, {
      status: upstreamRes.status,
      headers: buildResponseHeaders(upstreamRes, contentType),
    });
  }

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    headers: buildResponseHeaders(upstreamRes, contentType),
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return handleProxy(request, params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return handleProxy(request, params);
}
