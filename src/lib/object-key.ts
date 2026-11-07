const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

function hasTraversalMarks(value: string): boolean {
  const lower = value.toLowerCase();
  if (value.includes("..")) return true;
  if (value.includes("\\")) return true;
  if (lower.includes("%2f") || lower.includes("%5c")) return true;
  if (CONTROL_CHARS.test(value)) return true;
  return false;
}

/**
 * Nome de arquivo que será concatenado numa chave de bucket.
 * Recusa vazio, caminho, barra invertida, encoding de barra e controle.
 */
export function isUnsafeFileName(file: string): boolean {
  if (typeof file !== "string" || file.length === 0) return true;
  if (file.includes("/")) return true;
  if (hasTraversalMarks(file)) return true;
  try {
    const decoded = decodeURIComponent(file);
    if (decoded !== file) {
      if (decoded.includes("/")) return true;
      if (hasTraversalMarks(decoded)) return true;
    }
  } catch {
    return true;
  }
  return false;
}

/**
 * Chave completa recebida do cliente (já pode ter barras do prefixo).
 * Recusa travessia, mas aceita barras normais do caminho.
 */
export function isUnsafeObjectKey(key: string): boolean {
  if (typeof key !== "string" || key.length === 0) return true;
  if (key.startsWith("/") || key.includes("//")) return true;
  if (hasTraversalMarks(key)) return true;
  try {
    const decoded = decodeURIComponent(key);
    if (decoded !== key && (decoded.startsWith("/") || hasTraversalMarks(decoded))) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}
