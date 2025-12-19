import https from "https";
import crypto from "crypto";

type InterEnvironment = "PRODUCTION" | "SANDBOX";

type InterOAuthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

type InterCobrancaPagadorTipoPessoa = "FISICA" | "JURIDICA";

type InterCobrancaEmitRequest = {
  seuNumero: string;
  valorNominal: number;
  dataVencimento: string;
  numDiasAgenda?: number;
  pagador: {
    cpfCnpj: string;
    tipoPessoa: InterCobrancaPagadorTipoPessoa;
    nome: string;
    email?: string;
    ddd?: string;
    telefone?: string;
    endereco?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };
  mensagens?: {
    linha1?: string;
    linha2?: string;
  };
  formasRecebimento: Array<"BOLETO" | "PIX">;
};

type InterCobrancaEmitResponse = {
  codigoSolicitacao: string;
};

type InterCobrancaDetalheResponse = {
  cobranca?: {
    codigoSolicitacao?: string;
    seuNumero?: string;
    situacao?: string;
  };
};

type InterPixCobLocation = {
  id: number;
  location?: string;
  tipoCob?: string;
};

type InterPixCobResponse = {
  txid: string;
  status?: string;
  valor?: { original?: string };
  loc?: InterPixCobLocation;
};

type InterPixQrCodeResponse = {
  qrcode?: string;
  imagemQrcode?: string;
  payload?: string;
  encodedImage?: string;
};

let cachedToken: { token: string; expiresAtMs: number; scopeKey: string } | null = null;

function getInterEnvironment(): InterEnvironment {
  const env = (process.env.INTER_ENV || process.env.INTER_ENVIRONMENT || "").toUpperCase();
  if (env === "PRODUCTION" || env === "PROD") return "PRODUCTION";
  if (env === "SANDBOX" || env === "HOMOLOG" || env === "HOMOLOGACAO") return "SANDBOX";
  return process.env.NODE_ENV === "production" ? "PRODUCTION" : "SANDBOX";
}

function getInterPixBaseUrl(): string {
  const env = getInterEnvironment();
  return env === "PRODUCTION"
    ? "https://cdpj.partners.bancointer.com.br/pix/v2"
    : "https://cdpj-sandbox.partners.uatinter.co/pix/v2";
}

function getInterTokenUrl(): string {
  const env = getInterEnvironment();
  return env === "PRODUCTION"
    ? "https://cdpj.partners.bancointer.com.br/oauth/v2/token"
    : "https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token";
}

function getInterCobrancaBaseUrl(): string {
  const env = getInterEnvironment();
  return env === "PRODUCTION"
    ? "https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas"
    : "https://cdpj-sandbox.partners.uatinter.co/cobranca/v3/cobrancas";
}

function normalizePem(value: string): string {
  return value.trim().replace(/\\n/g, "\n");
}

function readPemFromEnv(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("-----BEGIN")) {
    return normalizePem(trimmed);
  }

  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8");
    if (decoded.includes("-----BEGIN")) return normalizePem(decoded);
  } catch {
    // ignore
  }

  return normalizePem(trimmed);
}

function getMtlsCredentials(): { cert: string; key: string; passphrase?: string } {
  const cert =
    readPemFromEnv(process.env.INTER_CERTIFICATE || process.env.CERTIFICATE) ||
    readPemFromEnv(process.env.INTER_CERT || process.env.CERT);

  const key =
    readPemFromEnv(process.env.INTER_PRIVATE_KEY || process.env.PRIVATE_KEY) ||
    readPemFromEnv(process.env.INTER_KEY || process.env.KEY);

  if (!cert) {
    throw new Error("Inter mTLS certificate não configurado (INTER_CERTIFICATE/CERTIFICATE)");
  }

  if (!key) {
    throw new Error("Inter mTLS private key não configurado (INTER_PRIVATE_KEY/PRIVATE_KEY)");
  }

  const passphrase = process.env.INTER_CERT_PASSPHRASE || process.env.CERT_PASSPHRASE || undefined;

  return { cert, key, passphrase };
}

async function interHttpsRequest<T>(params: {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  responseType?: "json" | "text" | "buffer";
}): Promise<T> {
  const { cert, key, passphrase } = getMtlsCredentials();

  return new Promise<T>((resolve, reject) => {
    const target = new URL(params.url);

    const req = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port ? Number(target.port) : undefined,
        path: `${target.pathname}${target.search}`,
        method: params.method,
        cert,
        key,
        passphrase,
        headers: params.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => {
          const rawBuffer = Buffer.concat(chunks);
          const rawText = rawBuffer.toString("utf8");
          const status = res.statusCode || 0;

          if (status < 200 || status >= 300) {
            reject(new Error(`Inter API HTTP ${status}: ${rawText || res.statusMessage || "Erro"}`));
            return;
          }

          const responseType = params.responseType || "json";
          if (responseType === "buffer") {
            resolve(rawBuffer as unknown as T);
            return;
          }

          if (responseType === "text") {
            resolve(rawText as unknown as T);
            return;
          }

          if (!rawText) {
            resolve({} as T);
            return;
          }

          try {
            resolve(JSON.parse(rawText) as T);
          } catch (err) {
            reject(
              new Error(
                `Resposta inválida do Inter (JSON parse): ${String(err)} | body=${rawText.slice(0, 500)}`,
              ),
            );
          }
        });
      },
    );

    req.on("error", reject);

    if (params.body) {
      req.write(params.body);
    }

    req.end();
  });
}

function normalizeCpfCnpjDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

export async function createInterCobrancaBoleto(params: {
  seuNumero: string;
  valor: number;
  dataVencimento: string;
  pagador: {
    cpfCnpj: string;
    nome: string;
    email?: string;
    phone?: string;
  };
  numDiasAgenda?: number;
  linha1?: string;
  linha2?: string;
}): Promise<{ codigoSolicitacao: string }> {
  const token = await getInterAccessToken(["boleto-cobranca.write"]);

  const cpfCnpjDigits = normalizeCpfCnpjDigits(params.pagador.cpfCnpj);
  const tipoPessoa: InterCobrancaPagadorTipoPessoa = cpfCnpjDigits.length === 14 ? "JURIDICA" : "FISICA";

  let ddd: string | undefined;
  let telefone: string | undefined;
  if (params.pagador.phone) {
    const digits = params.pagador.phone.replace(/\D/g, "");
    if (digits.length >= 10) {
      ddd = digits.slice(0, 2);
      telefone = digits.slice(2, 11);
    }
  }

  const payload: InterCobrancaEmitRequest = {
    seuNumero: params.seuNumero,
    valorNominal: Number(params.valor.toFixed(2)),
    dataVencimento: params.dataVencimento,
    numDiasAgenda: params.numDiasAgenda,
    pagador: {
      cpfCnpj: cpfCnpjDigits,
      tipoPessoa,
      nome: params.pagador.nome,
      email: params.pagador.email,
      ddd,
      telefone,
    },
    mensagens: params.linha1 || params.linha2 ? { linha1: params.linha1, linha2: params.linha2 } : undefined,
    formasRecebimento: ["BOLETO"],
  };

  const res = await interHttpsRequest<InterCobrancaEmitResponse>({
    url: `${getInterCobrancaBaseUrl()}`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getContaCorrenteHeader(),
    },
    body: JSON.stringify(payload),
  });

  if (!res.codigoSolicitacao) {
    throw new Error("Inter: cobrança boleto criada mas sem codigoSolicitacao");
  }

  return { codigoSolicitacao: res.codigoSolicitacao };
}

export async function getInterCobrancaDetalhe(codigoSolicitacao: string): Promise<InterCobrancaDetalheResponse> {
  const token = await getInterAccessToken(["boleto-cobranca.read"]);

  return interHttpsRequest<InterCobrancaDetalheResponse>({
    url: `${getInterCobrancaBaseUrl()}/${encodeURIComponent(codigoSolicitacao)}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...getContaCorrenteHeader(),
    },
  });
}

export async function getInterCobrancaPdf(codigoSolicitacao: string): Promise<Buffer> {
  const token = await getInterAccessToken(["boleto-cobranca.read"]);

  return interHttpsRequest<Buffer>({
    url: `${getInterCobrancaBaseUrl()}/${encodeURIComponent(codigoSolicitacao)}/pdf`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/pdf",
      ...getContaCorrenteHeader(),
    },
    responseType: "buffer",
  });
}

function scopeKey(scopes: string[]): string {
  return scopes
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join(" ");
}

export async function getInterAccessToken(scopes: string[]): Promise<string> {
  const clientId = process.env.INTER_CLIENT_ID || process.env.CLIENT_ID;
  const clientSecret = process.env.INTER_CLIENT_SECRET || process.env.CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Inter OAuth não configurado (INTER_CLIENT_ID/INTER_CLIENT_SECRET)");
  }

  const key = scopeKey(scopes);
  const now = Date.now();

  if (cachedToken && cachedToken.scopeKey === key && cachedToken.expiresAtMs > now + 30_000) {
    return cachedToken.token;
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    scope: key,
  }).toString();

  const tokenRes = await interHttpsRequest<InterOAuthTokenResponse>({
    url: getInterTokenUrl(),
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form,
  });

  const expiresAtMs = Date.now() + Math.max(0, (tokenRes.expires_in || 3600) - 60) * 1000;
  cachedToken = { token: tokenRes.access_token, expiresAtMs, scopeKey: key };

  return tokenRes.access_token;
}

function generateTxid(): string {
  return crypto.randomBytes(16).toString("hex");
}

function getContaCorrenteHeader(): Record<string, string> {
  const conta = process.env.INTER_CONTA_CORRENTE || process.env.X_INTER_CONTA_CORRENTE;
  return conta ? { "x-conta-corrente": conta } : {};
}

export async function createInterPixCobImmediate(params: {
  txid?: string;
  valor: number;
  chavePix: string;
  expiracaoSegundos: number;
  solicitacaoPagador?: string;
  devedorCpfCnpj?: string;
}): Promise<{ txid: string; locId: number }> {
  const token = await getInterAccessToken(["cob.write", "payloadlocation.write"]);
  const txid = params.txid || generateTxid();

  const payload: any = {
    calendario: { expiracao: params.expiracaoSegundos },
    valor: { original: params.valor.toFixed(2) },
    chave: params.chavePix,
  };

  if (params.solicitacaoPagador) {
    payload.solicitacaoPagador = params.solicitacaoPagador;
  }

  if (params.devedorCpfCnpj) {
    const digits = params.devedorCpfCnpj.replace(/\D/g, "");
    if (digits.length === 11) payload.devedor = { cpf: digits };
    if (digits.length === 14) payload.devedor = { cnpj: digits };
  }

  const res = await interHttpsRequest<InterPixCobResponse>({
    url: `${getInterPixBaseUrl()}/cob/${txid}`,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getContaCorrenteHeader(),
    },
    body: JSON.stringify(payload),
  });

  const locId = res.loc?.id;
  if (!locId) {
    throw new Error("Inter: cobrança criada mas sem loc.id para gerar QRCode");
  }

  return { txid: res.txid || txid, locId };
}

export async function getInterPixQrCodeByLocId(locId: number): Promise<{ copiaECola: string; qrCodeBase64: string }> {
  const token = await getInterAccessToken(["payloadlocation.read"]);

  const data = await interHttpsRequest<InterPixQrCodeResponse>({
    url: `${getInterPixBaseUrl()}/loc/${locId}/qrcode`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...getContaCorrenteHeader(),
    },
  });

  const copiaECola = (data.qrcode || data.payload || "").trim();
  const qrCodeBase64 = (data.imagemQrcode || data.encodedImage || "").trim();

  if (!copiaECola || !qrCodeBase64) {
    throw new Error("Inter: QRCode inválido (sem payload ou imagem)");
  }

  return { copiaECola, qrCodeBase64 };
}

export async function getInterPixCob(txid: string): Promise<InterPixCobResponse> {
  const token = await getInterAccessToken(["cob.read"]);

  return interHttpsRequest<InterPixCobResponse>({
    url: `${getInterPixBaseUrl()}/cob/${encodeURIComponent(txid)}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...getContaCorrenteHeader(),
    },
  });
}
