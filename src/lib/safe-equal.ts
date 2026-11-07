import { timingSafeEqual } from "crypto";

/**
 * Compara dois segredos em tempo constante.
 * Tamanhos diferentes nunca são iguais. A comparação extra evita
 * retornar antes de gastar um tempo parecido com o caso de mesmo tamanho.
 */
export function secretsMatch(received: string, expected: string): boolean {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * Autoriza chamada de agendador: aceita o header x-cron-secret ou
 * Authorization: Bearer <segredo>. Segredos vazios são ignorados; sem
 * nenhum segredo configurado, recusa sempre.
 */
export function cronRequestAuthorized(
  request: { headers: { get(name: string): string | null } },
  secrets: Array<string | undefined>,
): boolean {
  const valid = secrets.filter((s): s is string => typeof s === "string" && s.length > 0);
  if (valid.length === 0) return false;

  const auth = request.headers.get("authorization");
  const candidates = [
    request.headers.get("x-cron-secret"),
    auth && auth.startsWith("Bearer ") ? auth.slice(7) : null,
  ].filter((c): c is string => typeof c === "string" && c.length > 0);

  return candidates.some((c) => valid.some((s) => secretsMatch(c, s)));
}
