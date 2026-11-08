export const TELEMETRY_PHASES = [
  "queued",
  "download",
  "probe",
  "subtitles",
  "transcode",
  "upload",
  "cleanup",
  "done",
  "error",
];

function num(value, { min = -Infinity } = {}) {
  const n = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(n) && n >= min ? n : null;
}

function str(value, max = 200) {
  return typeof value === "string" ? value.slice(0, max) : null;
}

function round(value, digits = 2) {
  if (value === null) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * Monta o objeto de telemetria completo do contrato a partir de um estado parcial.
 */
export function buildTelemetry(state = {}) {
  const phase = TELEMETRY_PHASES.includes(state.phase) ? state.phase : "queued";
  const source = state.source && typeof state.source === "object" ? state.source : null;

  return {
    phase,
    phase_label: str(state.phase_label) ?? "",
    encoder: str(state.encoder, 40),
    rendition: str(state.rendition, 40),
    rendition_index: num(state.rendition_index, { min: 0 }),
    renditions_total: num(state.renditions_total, { min: 0 }),
    fps: round(num(state.fps, { min: 0 })),
    speed_x: round(num(state.speed_x, { min: 0 })),
    out_time_sec: round(num(state.out_time_sec, { min: 0 })),
    duration_sec: round(num(state.duration_sec, { min: 0 })),
    bytes_done: num(state.bytes_done, { min: 0 }),
    bytes_total: num(state.bytes_total, { min: 0 }),
    mbps: round(num(state.mbps, { min: 0 })),
    files_done: num(state.files_done, { min: 0 }),
    files_total: num(state.files_total, { min: 0 }),
    eta_sec: round(num(state.eta_sec, { min: 0 }), 1),
    elapsed_sec: round(num(state.elapsed_sec, { min: 0 }) ?? 0, 1),
    source: source
      ? {
          width: num(source.width, { min: 0 }) ?? 0,
          height: num(source.height, { min: 0 }) ?? 0,
          duration_sec: round(num(source.duration_sec, { min: 0 }) ?? 0),
          size_bytes: num(source.size_bytes, { min: 0 }),
        }
      : null,
    updated_at: num(state.updated_at, { min: 0 }) ?? Date.now() / 1000,
  };
}

/**
 * Valida a telemetria recebida de um trabalhador remoto. Devolve null se nao for um objeto.
 */
export function sanitizeTelemetry(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return buildTelemetry({ ...raw, updated_at: Date.now() / 1000 });
}
