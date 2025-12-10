---
 audience: user
---

# FlixCRD – Changelog (Usuário Final)

Este arquivo registra mudanças que afetam diretamente quem assiste (web/app).

## 2025-12-09

### O que há de novo

- **Legendas no player web** – quando um filme ou episódio tem legenda salva em `.vtt`, o player web agora mostra a opção de ligar/desligar legendas.
- **Player preparado para múltiplas faixas** – o backend envia um array de legendas (`subtitles[]`) e a tela de reprodução (`/watch/[id]`) cria automaticamente as faixas para você escolher idioma.

### Melhorias de estabilidade

- **Conversão de vídeo mais confiável** – alguns vídeos 10‑bit podiam falhar na conversão HLS. O processo foi ajustado para sempre gerar saída em 8‑bit (`yuv420p`), reduzindo erros e melhorando a compatibilidade com navegadores e TVs.

### Bastidores (mas que ajudam você)

- **Legendas chegam mais rápido** – o painel admin ganhou automações para buscar, baixar e anexar legendas direto no servidor, diminuindo o tempo entre o upload e o conteúdo aparecer com legenda disponível.
- **IA ajudando na organização de episódios** – o sistema usa IA para entender temporada/episódio a partir do nome do arquivo, o que deixa o catálogo de séries e animes mais organizado.
- **Mais estabilidade e velocidade** – monitoramos serviços (storage, transcoder, CDN) em tempo real e podemos limpar o cache CDN sob demanda, o que ajuda a manter streaming e catálogos carregando de forma mais confiável.
