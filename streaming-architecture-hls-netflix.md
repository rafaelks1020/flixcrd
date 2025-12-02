# 🎬 Arquitetura de Streaming HLS estilo Netflix  
## Usando Next.js (Vercel) + Wasabi S3 + HLS (.m3u8) + Presigned URLs

## 📌 Objetivo
Criar um sistema de streaming estilo Netflix, com qualidade adaptativa, thumbnails, catálogo organizado e player otimizado, usando:
- **Next.js (deploy no Vercel)** para frontend e API routes leves
- **Wasabi S3** para armazenamento e entrega de vídeos
- **HLS (.m3u8)** para streaming adaptativo
- **hls.js** como player no navegador
- **Presigned URLs** para proteger vídeos privados

O projeto deve ser modular, escalável, performático e barato.

---

# 🚀 1. Arquitetura Geral

Usuário → Next.js (Vercel) → Player HLS → Wasabi (HLS segments .ts + manifest .m3u8)

- O **Vercel não serve vídeos**, apenas a interface e as páginas.
- O **Wasabi entrega os vídeos diretamente**, suportando `Range` e grandes arquivos.
- O vídeo é convertido para HLS com vários níveis de qualidade.
- O player do navegador usa o arquivo `.m3u8` carregado via `hls.js`.

---

# 🗃️ 2. Estrutura dos Arquivos no Wasabi

Cada vídeo deve ter sua pasta contendo:

movie-id/
  master.m3u8
  720p.m3u8
  480p.m3u8
  360p.m3u8
  segments/
      seg1.ts
      seg2.ts
      seg3.ts
      ...
  thumbnail.jpg
  poster.jpg
  metadata.json

---

# 🎞️ 3. Conversão de Vídeo para HLS

ffmpeg -i input.mp4 \
  -profile:v baseline -level 3.0 \
  -start_number 0 \
  -hls_time 6 \
  -hls_list_size 0 \
  -f hls master.m3u8

Conversão multi-quality está no arquivo original enviado.

---

# 🧩 4. Player HLS no Next.js

(use o conteúdo completo da versão enviada antes)

---

# 🔐 5. Presigned URLs

(use o conteúdo completo da versão enviada antes)

---

# 🎛️ 6. Painel Administrativo
# 🧱 7. Interface estilo Netflix
# 📡 8. Banco de Dados
# 💰 9. Custos
# 🏁 10. Resultado Final

(Arquivo completo entregue acima no chat)
