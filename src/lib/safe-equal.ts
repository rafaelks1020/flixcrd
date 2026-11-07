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
