# PFlix HLS Transcoder

Servico local em Node.js (20+) para conversao sob demanda de videos em HLS VOD com multiplas renditions e extracao automatica de legendas de texto para WebVTT.

## Requisitos

- Node.js 20 ou superior
- `ffmpeg` (com `libx264` e `aac`) e `ffprobe` disponiveis no `PATH`
- Utilitario `nice` disponivel no sistema

## Instalacao e Execucao Local

```bash
cd services/transcoder
npm install
cp .env.example .env
# Edite .env definindo ao menos TRANSCODER_TOKEN e as credenciais S3
npm start
```

Para executar a suite automatizada de ponta a ponta (gera um video de 10 s `1280x720`, sobe um S3 falso local e valida `master.m3u8`, `720p`, `480p` e `.vtt`):

```bash
cd services/transcoder
npm test
```

## Instalacao via systemd

1. Configure o arquivo `/home/rafael/Jobs/Pessoais/Flix/pflix/services/transcoder/.env` (com permissoes `chmod 600 .env`) e defina o mesmo `TRANSCODER_TOKEN` no `.env` do app Next.js (junto com `TRANSCODER_BASE_URL=http://127.0.0.1:8001`).
2. Instale e ative a unit:

```bash
sudo cp /home/rafael/Jobs/Pessoais/Flix/pflix/services/transcoder/pflix-transcoder.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pflix-transcoder
sudo systemctl status pflix-transcoder
```

Logs em tempo real:

```bash
journalctl -u pflix-transcoder -f
```

## Variaveis de Ambiente

| Variavel | Padrao | Descricao |
| --- | --- | --- |
| `TRANSCODER_TOKEN` | (obrigatorio) | Token exigido no header `Authorization: Bearer <token>` em todas as rotas. Sem ele o servico recusa iniciar. |
| `TRANSCODER_HOST` | `127.0.0.1` | Endereco IP de escuta HTTP. |
| `TRANSCODER_PORT` | `8001` | Porta TCP de escuta HTTP. |
| `TRANSCODER_WORKDIR` | `/var/tmp/pflix-transcoder` | Diretorio de trabalho para arquivos temporarios e persistencia da fila (`jobs.json`). |
| `TRANSCODER_CONCURRENCY` | `1` | Numero maximo de jobs processados simultaneamente. |
| `TRANSCODER_THREADS` | `6` | Numero de threads passadas para `-threads` do `ffmpeg` (executado com `nice -n 15`). |
| `TRANSCODER_WORKER_TOKEN` | (vazio) | Habilita os endpoints `/worker/*` do trabalhador remoto. |
| `S3_ENDPOINT` | `WASABI_ENDPOINT` | Endpoint HTTP/HTTPS do storage compativel com S3. |
| `S3_REGION` | `us-east-1` (ou `WASABI_REGION`) | Regiao S3. |
| `S3_ACCESS_KEY_ID` | `WASABI_ACCESS_KEY_ID` | Access Key do storage S3. |
| `S3_SECRET_ACCESS_KEY` | `WASABI_SECRET_ACCESS_KEY` | Secret Key do storage S3. |
| `S3_BUCKET_NAME` | `WASABI_BUCKET_NAME` | Bucket padrao quando omitido no corpo da requisicao. |

## Trabalhador remoto (Windows com GPU)

Um PC com GPU (ex.: Windows, AMD Radeon com `h264_amf`) pode puxar jobs da fila da VPS e converter localmente. A VPS só converte quando nenhum trabalhador está online (heartbeat nos últimos 30 s) ou quando o job já falhou 2 vezes no trabalhador.

1. Na VPS, defina `TRANSCODER_WORKER_TOKEN` no `.env` (token diferente do `TRANSCODER_TOKEN`) e reinicie o serviço. Sem essa variável os endpoints `/worker/*` respondem `404`. O serviço precisa ser alcançável pelo PC (túnel, proxy reverso com HTTPS ou VPN).
2. No Windows, instale Node 20+ e um `ffmpeg` com `h264_amf` (ou `h264_nvenc`/`h264_qsv`) no `PATH`.
3. Copie esta pasta (`services/transcoder`), rode `npm install` e crie o `.env`:

```env
TRANSCODER_QUEUE_URL=https://endereco-do-transcoder
TRANSCODER_WORKER_TOKEN=mesmo-token-da-vps
WORKER_NAME=Desktop
WORKER_ENCODER=auto
S3_ENDPOINT=https://s3.us-east-1.wasabisys.com
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=sua-access-key
S3_SECRET_ACCESS_KEY=sua-secret-key
```

4. Rode `npm run worker` (equivale a `node src/worker.js`). Ctrl+C encerra de forma limpa e devolve o job em andamento à fila.

Opcionais: `WORKER_ID` (padrão: nome do computador), `FFMPEG_PATH`, `FFPROBE_PATH`, `WORKER_ENCODER` (`auto`, `h264_amf`, `h264_nvenc`, `h264_qsv`, `libx264`; `auto` testa nvenc, amf e qsv nessa ordem), `WORKER_THREADS`, `WORKER_WORKDIR` (padrão `%TEMP%\pflix-worker`), `WORKER_GPU` (texto livre; no Windows é detectado via PowerShell se vazio), `WORKER_NICE=0` (desliga o `nice` no Linux). O bucket vem no próprio job.

Endpoints (Bearer `TRANSCODER_WORKER_TOKEN`): `POST /worker/heartbeat`, `POST /worker/claim` (200 com o job ou 204), `POST /worker/jobs/:id/progress` (409 se o job não é mais deste trabalhador), `POST /worker/jobs/:id/complete`, `POST /worker/jobs/:id/fail`. Lease de 60 s sem progresso nem heartbeat conta uma falha e devolve o job à fila. `GET /workers` (Bearer `TRANSCODER_TOKEN`) lista a VPS e os trabalhadores.

Os jobs públicos ganham `executor`, `worker_name`, `desktop_failures`, `attempts`, `events` (máx. 60) e `telemetry` (fase, encoder, fps, velocidade, bytes, Mbps, ETA).

## Contrato HTTP

Todas as rotas exigem o header `Authorization: Bearer <TRANSCODER_TOKEN>`.

### `POST /jobs/hls`

Enfileira um novo job de conversao HLS VOD.

Corpo JSON:

```json
{
  "bucket": "meu-bucket",
  "source_key": "titles/meu-filme/arquivo.mkv",
  "dest_prefix": "titles/meu-filme/",
  "crf": 20,
  "delete_source": false,
  "titleId": "opcional",
  "episodeId": "opcional"
}
```

Regras de validacao e processamento:
- `source_key` e `dest_prefix` nao podem conter `..`, `\\`, barras duplicadas nem iniciar com `/`.
- `crf` padrao `20` (`preset veryfast`, `libx264`, `yuv420p`, segmentos MPEG-TS de `6` segundos, audio AAC `128k` estereo).
- Renditions selecionadas conforme a altura de origem sem nunca fazer upscale: `1080p` (se origem >= 1080), `720p` (se >= 720), `480p` (se >= 480; se menor que 480, mantem a altura par original).
- Faixas de legenda de texto embutidas sao convertidas para `.vtt` no mesmo `dest_prefix`.
- Gravacao no bucket em estrutura plana sob `dest_prefix`: `master.m3u8`, `<rendition>.m3u8`, `<rendition>_000.ts` e `subtitle-<lang>.vtt`.
- Se `delete_source` for `true`, o `source_key` e removido do bucket somente apos o upload completo de todos os artefatos HLS.
- O diretorio temporario local do job e removido sempre ao final (sucesso ou erro).

Resposta `202 Accepted`:

```json
{
  "id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "job_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "status": "queued",
  "progress": 0,
  "message": "Na fila aguardando conversao",
  "error": null,
  "bucket": "meu-bucket",
  "source_key": "titles/meu-filme/arquivo.mkv",
  "dest_prefix": "titles/meu-filme/",
  "crf": 20,
  "delete_source": false,
  "title_id": "opcional",
  "episode_id": null,
  "renditions": [],
  "subtitles": [],
  "created_at": 1730990000.123,
  "updated_at": 1730990000.123
}
```

### `GET /jobs`

Retorna `200 OK` com um array JSON de jobs ordenados do mais recente para o mais antigo (`status`: `queued`, `running`, `completed` ou `error`; `created_at` e `updated_at` em segundos Unix).

### `GET /jobs/:id`

Retorna `200 OK` com o objeto do job correspondente ou `404 Not Found` (`{ "error": "Job nao encontrado.", "detail": "Job nao encontrado." }`).
