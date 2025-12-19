---
 audience: user
---

# FlixCRD – Changelog (Usuário Final)

Este arquivo registra mudanças que afetam diretamente quem assiste (web/app).

## 2025-12-18

### O que há de novo

- **Recomendados pela IA (LAB)** – no LAB (`/lab`) agora você pode escrever o que gosta (ex.: "comédia romântica + John Wick") e receber recomendações parecidas dentro do catálogo do LAB.
- **Limite mensal** – para manter o custo baixo, a geração por IA no LAB pode ser feita **1 vez por mês**.
- **Melhorias de exibição** – os recomendados pela IA agora aparecem em **formato de catálogo (grid)** e com mais variedade.
- **Melhorias de precisão** – a IA passou a respeitar melhor o tipo (filme vs série) e filtros de gosto (gêneros/ano).

## 2025-12-17

### O que há de novo

- **LAB com visual igual ao dashboard** – a home do LAB (`/lab`) agora usa o mesmo layout Premium (Hero + carrosséis), com navegação e cards no mesmo padrão do app.
- **Buscar no LAB pela navbar** – a busca no topo quando você estiver no LAB agora direciona para `/lab/explore?q=...` e mostra resultados do catálogo do LAB.
- **Explorar inteligente (LAB)** – em `/lab/explore` agora existem seções automáticas:
  - **Em alta no LAB** (tendências do momento)
  - **Recomendados pra você** (baseado no que você abriu/salvou no LAB)
- **Listas do LAB (no dispositivo)** – no LAB agora existe:
  - Continuar assistindo
  - Minha lista
  - Assistir depois
  Essas listas ficam salvas localmente no seu navegador (localStorage).

### Bastidores (mas que ajudam você)

- **Métricas de uso** – começamos a medir tempo de uso/atividade para melhorar performance, recomendações e estabilidade da plataforma.

## 2025-12-10

### O que há de novo
- **Recuperação de senha por email** – você recebe um link válido por 1 hora para redefinir a senha.
- **Emails de pagamento mais claros** – PIX envia QR Code e código copia-e-cola; boleto envia link direto; cartão aprovado envia confirmação imediata.
- **Confirmação/atraso de pagamento** – quando o pagamento é confirmado ou fica vencido, você recebe email automático avisando.

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
