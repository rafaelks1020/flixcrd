# PMusic — Fluxo de Upload e Leitura no Wasabi

Documento reduzido para focar **exclusivamente** em como enviar e ler arquivos de áudio no mesmo bucket Wasabi já utilizado pelo FlixCRD, mas isolando tudo sob o prefixo `music/`.

## 1. Credenciais e cliente S3
- Reutilize as variáveis já existentes no FlixCRD:
  - `WASABI_ACCESS_KEY_ID`
  - `WASABI_SECRET_ACCESS_KEY`
  - `WASABI_ENDPOINT`
  - `WASABI_REGION`
  - `WASABI_BUCKET_NAME`
- Instancie o cliente com `forcePathStyle: true`, igual ao `wasabiClient`. @flixcrd-web/src/lib/wasabi.ts#1-25

## 2. Convenção de prefixos para música
- Todo arquivo do PMusic deve viver dentro de `music/`.
- Sugestão: `music/<artistSlug>/<albumSlug>/<trackId>/`.
- Salve esse prefixo em um campo próprio (`audioPath`) assim que gerar a URL de upload, do mesmo jeito que o Flix grava `hlsPath`. @flixcrd-web/src/app/api/wasabi/upload-url/route.ts#29-118

## 3. Fluxo de upload
### 3.1 Upload simples (PUT direto)
1. Rota POST `/api/wasabi/upload-url` recebe `{ trackId, filename, contentType }`.
2. Resolver do prefixo monta `music/...` com base no catálogo musical.
3. Monte o `key = prefix + filename` e chame `getSignedUrl` com `PutObjectCommand`.
4. Retorne `{ uploadUrl, key, prefix }` para o frontend executar o PUT.
5. Atualize o registro da faixa com `audioPath = prefix` para futuras leituras.

### 3.2 Upload multipart
Necessário para arquivos grandes (ex.: FLAC).
1. Rota POST `/api/wasabi/multipart/start` recebe `{ trackId, filename, contentType }`.
2. Calcula o mesmo prefixo `music/...` e chama `CreateMultipartUploadCommand`.
3. Retorna `{ uploadId, key, prefix }`.
4. Para cada parte, gere URLs com `/api/wasabi/multipart/part-url` (mesmo contrato do Flix).
5. Ao final, finalize com `/api/wasabi/multipart/complete` informando `ETags`.
6. Exponha `/api/wasabi/multipart/abort` para cancelar uploads interrompidos (opcional porém já existente no fluxo atual).

### 3.3 Boas práticas herdadas do Flix
- **Retry automático**: use até 3 tentativas antes de falhar (vide regras em `UPLOADS_IMPROVEMENTS.md`). @flixcrd-web/docs/ops/UPLOADS_IMPROVEMENTS.md#136-205
- **Fila ou paralelo**: mesmo componente de upload permite modo fila ou paralelo; só muda o prefixo.
- **Validação**: valide extensão e tamanho antes de pedir a URL para não sujar o bucket desnecessariamente. @flixcrd-web/docs/ops/UPLOADS_IMPROVEMENTS.md#146-214

## 4. Fluxo de leitura (download/playback)
Mesmo bucket, apenas outro prefixo.

1. Crie uma rota (ex.: `GET /api/tracks/[id]/playback`) que:
   - Busca a faixa no banco e lê `audioPath`.
   - Lista o objeto alvo (ex.: `music/.../track.mp3` ou `music/.../master.m3u8`).
   - Monta um `GetObjectCommand` e gera uma presigned URL com `getSignedUrl`.
2. Retorne `{ playbackUrl, contentType }` para o cliente tocar o arquivo.  
3. Caso haja múltiplas versões (ex.: `.mp3` e `.flac`), basta gerar URLs adicionais apontando para objetos diferentes sob o mesmo prefixo.

### 4.1 Uso com o Cloudflare Worker atual (sem HLS)
- O Worker existente já aceita qualquer arquivo servido via `/s/{obfuscatedId}/{file}?token=...`.  
- Ao gerar o token em `/api/generate-token`, basta montar `streamUrl` com o nome real do arquivo (ex.: `track.flac`), em vez de fixar `master.m3u8`.  
- Nenhuma mudança no Worker é necessária; ele fará proxy do objeto original (FLAC/MP3/WAV) com proteção anti-DMCA, cache e suporte a `Range`.  
- Se quiser HLS no futuro, é só voltar a gerar manifests e consumir `/s/.../master.m3u8`.

## 5. Checklist mínimo
1. Clonar `lib/wasabi.ts` para o PMusic e garantir que todas as vars `WASABI_*` existem.
2. Implementar rotas `/api/wasabi/upload-url` e `/api/wasabi/multipart/start` copiando o código atual e trocando apenas o resolvedor do prefixo para `music/...`.
3. Salvar `audioPath` na faixa assim que a URL for solicitada.
4. No frontend de upload, apontar as chamadas para as rotas novas e aceitar extensões de áudio.
5. Criar a rota de leitura que gera presigned URLs para os objetos `music/...`.
6. (Opcional) Manter o endpoint de abort multipart para lidar com uploads cancelados.

Com isso você reaproveita toda a infraestrutura existente (credenciais, bucket, lógica de retry e multipart) focando apenas nos dois pontos necessários: **upload** e **leitura** de arquivos de áudio no Wasabi, sob o namespace `music/`.
