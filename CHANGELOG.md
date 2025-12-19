# Changelog

Este arquivo é o changelog principal do **flixcrd-web**.

- Formato: **Conventional Commits** + **SemVer** (`vX.Y.Z`)
- Geração: **automática** via *Release Please* (GitHub Actions)

## [0.3.0](https://github.com/rafaelks1020/flixcrd/compare/flixcrd-web-v0.2.0...flixcrd-web-v0.3.0) (2025-12-19)


### Features

* Add a new admin dashboard layout with dynamic navigation and a … ([9032cf7](https://github.com/rafaelks1020/flixcrd/commit/9032cf7bf84930a30ff731ca56daf2e870a82282))
* Add a new admin dashboard layout with dynamic navigation and a PremiumNavbar component. ([3a49288](https://github.com/rafaelks1020/flixcrd/commit/3a4928811027853f23924310ff0051cb28486058))
* **admin:** generate catalog synopsis with AI ([bdf0fde](https://github.com/rafaelks1020/flixcrd/commit/bdf0fde4b29eec5611b33ee3696cfbc50ef31907))
* **admin:** show system version in settings ([ea81461](https://github.com/rafaelks1020/flixcrd/commit/ea81461dcd06b565452bf4f15e583d735ccf43ab))
* **ai:** split catalog vs tagline models ([8d5aa1f](https://github.com/rafaelks1020/flixcrd/commit/8d5aa1f65f58b5d7631b2ffeb6669cc2608904df))
* Introduce Lab, Browse, and Admin Settings features with new UI components, API routes, and database schema, including a neural scan search interface. ([e1077cb](https://github.com/rafaelks1020/flixcrd/commit/e1077cbc94cfd5c7bc7f7e88817bdb804caab87b))
* **lab:** use pure streamtape player without ads/logo ([0a7cb4a](https://github.com/rafaelks1020/flixcrd/commit/0a7cb4a25e39638f43b3c3c1dc21378359973a5b))
* **payments:** selector ASAAS/INTER + webhooks Inter (default ASAAS) ([818d417](https://github.com/rafaelks1020/flixcrd/commit/818d41756547df556d76a4c67dba90a2cd618d8b))
* **pwa:** web push + PWA perfection ([1d84e2a](https://github.com/rafaelks1020/flixcrd/commit/1d84e2a909caf9fb58a1122a60f2edb2a58084b3))
* **tmdb:** support search by IMDb id ([61b12f5](https://github.com/rafaelks1020/flixcrd/commit/61b12f536e8123c789e3ae158763d4624e70ee41))


### Bug Fixes

* **admin:** correct users API response data structure handling ([2a8497e](https://github.com/rafaelks1020/flixcrd/commit/2a8497e30598d76c6be4d3c6eae8a0f3c881e463))
* **ai:** retry OpenRouter model and surface model in UI errors ([ad99ac3](https://github.com/rafaelks1020/flixcrd/commit/ad99ac38be5a83b9a932db4edf83f18968648bcf))
* allow ADMIN to view request details ([5bf3fdd](https://github.com/rafaelks1020/flixcrd/commit/5bf3fddddbb9869cdef776c8cf579ae08a09d3e4))
* **approval:** align register email and refresh approval status ([8ac52ae](https://github.com/rafaelks1020/flixcrd/commit/8ac52aea205dc75e40a130ae5639d85f1e83ffdc))
* **lab:** accept legacy type_/id_ params in video-id ([83d28dc](https://github.com/rafaelks1020/flixcrd/commit/83d28dc4d21713603c4a07148c2a5893803d3cfa))
* **lab:** improve streamtape detection fallback ([3ab0c33](https://github.com/rafaelks1020/flixcrd/commit/3ab0c33bb224edfc8f3fad2902b23f8d94b779f8))
* **lab:** robust video-id extraction ([d7f8144](https://github.com/rafaelks1020/flixcrd/commit/d7f8144a602d88058cc4e5d3911a54fb1512f8a6))
* **lab:** video-id auth via NextAuth session ([8a0e4b0](https://github.com/rafaelks1020/flixcrd/commit/8a0e4b017d8f935fd7f800c702c27c129157e68d))
* **metrics:** allow presence heartbeat via NextAuth or bearer ([868699d](https://github.com/rafaelks1020/flixcrd/commit/868699dd445b0b696bd0a75f214d47147ae6460b))
* **pwa:** offline static + themeColor viewport + webpush key 503 ([bdc40c3](https://github.com/rafaelks1020/flixcrd/commit/bdc40c35c93ab869234aeea9c6f21400bdf7b4a0))
* resolve Admin Catalog build errors and restore Lab Majestic HUD ([0e01e79](https://github.com/rafaelks1020/flixcrd/commit/0e01e79130efd4185310c1ff9aae80aaf464d0ca))


### Performance Improvements

* **api:** reduce health/progress overhead on Vercel ([20f4a3b](https://github.com/rafaelks1020/flixcrd/commit/20f4a3b6fb3785de75bb0ea61b317c94b62d7bea))

## [0.2.0](https://github.com/rafaelks1020/flixcrd/compare/flixcrd-web-v0.1.0...flixcrd-web-v0.2.0) (2025-12-13)


### Features

* add /api/version endpoint ([d9f2d9e](https://github.com/rafaelks1020/flixcrd/commit/d9f2d9e730b88eadc0d65d7825191731ca295d9b))
* add admin notifications page and API endpoints ([610f5fd](https://github.com/rafaelks1020/flixcrd/commit/610f5fdd54ba4338fb573c01f4eec50dc5406dcf))
* add CronTask model and integrate cron tasks display in system status page ([e6abb9a](https://github.com/rafaelks1020/flixcrd/commit/e6abb9a7902fd4c2c09598c1710050f5c5a7d471))
* add global CORS middleware and JWT auth support for mobile app ([45a85eb](https://github.com/rafaelks1020/flixcrd/commit/45a85eb58eee014c390f80442e1f0b2366269dbf))
* add mobile login endpoint /api/auth/mobile with JWT ([70b27ab](https://github.com/rafaelks1020/flixcrd/commit/70b27ab6d4b8665f11f6b6301f9c41f8f3afc4e5))
* add push notifications API endpoints and database models ([0ae03af](https://github.com/rafaelks1020/flixcrd/commit/0ae03afb2d0f5a5844cfc37686cea51dc3ee587a))
* add user approval system - admin must approve users before they can pay and access ([c6b6361](https://github.com/rafaelks1020/flixcrd/commit/c6b636111ba66e46712ce2b24af4a32d2b651655))
* adicionar busca e filtros no catálogo - busca por nome, filtro por tipo e status HLS ([b117a60](https://github.com/rafaelks1020/flixcrd/commit/b117a60de072e68ea2052322f22842463f09d407))
* adicionar componentes UI avançados - StatsCard, LoadingSpinner, EmptyState, ProgressBar, Badge, Tooltip, ConfirmDialog, AnimatedCounter ([84d7c6a](https://github.com/rafaelks1020/flixcrd/commit/84d7c6ae43e4f66e2f3bf731f1e5c5ad5e35f970))
* adicionar estatísticas de uso e sistema de assinaturas ([c5424a1](https://github.com/rafaelks1020/flixcrd/commit/c5424a135c196093d691e3dd94f2a1bd20274627))
* adicionar página de Analytics com estatísticas, gráficos e top títulos ([3a8d972](https://github.com/rafaelks1020/flixcrd/commit/3a8d972e258f4e59f3df505e0ca0968bcb69472d))
* adicionar página de detalhes, player avançado e browse melhorado ([755c600](https://github.com/rafaelks1020/flixcrd/commit/755c600e8b5bf676c7e9b06731b2269bb9f0707e))
* adicionar paginação no catálogo (20 itens por página) com navegação inteligente ([9c5a0ce](https://github.com/rafaelks1020/flixcrd/commit/9c5a0cef20938ea0deb1037661fcda095df3b8c1))
* adicionar páginas de Configurações e Logs + busca de usuários ([e81c5e6](https://github.com/rafaelks1020/flixcrd/commit/e81c5e6ba856391e52a83e6db4cea1d68d930272))
* adicionar proteção inteligente contra títulos duplicados com detecção automática ([c4489b2](https://github.com/rafaelks1020/flixcrd/commit/c4489b29566c482a76552f7b49baad5d49c4fb79))
* adicionar thumbnails de pôsteres no catálogo e melhorar badges de status ([35cb88c](https://github.com/rafaelks1020/flixcrd/commit/35cb88ceebdc3318bb410c49df20f49883331c2d))
* adicionar toast notifications e página de ações rápidas com testes de conexão ([dbfeff3](https://github.com/rafaelks1020/flixcrd/commit/dbfeff3580d3cee3ede4ba71923fc97d171365ae))
* adicionar velocidade de upload em tempo real com MB/s, KB/s, GB/s e tempo estimado ([d2aca74](https://github.com/rafaelks1020/flixcrd/commit/d2aca74f1680faf55e2072890d548da3ffe3590b))
* criar episódios automaticamente ao detectar arquivos de série no upload unificado ([57838b1](https://github.com/rafaelks1020/flixcrd/commit/57838b1b12fb4f63bce2a09bb1982ecc4df2b59e))
* fallback automático para vídeo direto quando HLS não encontrado ([168acc2](https://github.com/rafaelks1020/flixcrd/commit/168acc2ee104478e59c5cc9432328d5d40cec41d))
* implementar melhorias completas do admin (42+ features) ([5674bbb](https://github.com/rafaelks1020/flixcrd/commit/5674bbbb67be39876c76ade06deb518e99af0268))
* implementar nova UX/UI premium para usuário final ([35bd98e](https://github.com/rafaelks1020/flixcrd/commit/35bd98e95f28ec860662578ffd80cf1b97b72020))
* integrar todos os componentes criados nas páginas admin ([15d8a8a](https://github.com/rafaelks1020/flixcrd/commit/15d8a8a39a1e9d853c1aa8173b0fb4184319ec15))
* mailjet emails e recuperacao de senha ([95f0362](https://github.com/rafaelks1020/flixcrd/commit/95f0362564ff3eb5f23a437b88035b4b4e9c9cc6))
* melhorar dashboard com breakdown de tipos, barra de progresso HLS e últimos títulos ([70a60dd](https://github.com/rafaelks1020/flixcrd/commit/70a60dd5a721482c78a1b9e64a50ca8366ff1993))
* melhorar jobs HLS com cards de stats, filtros, toggle auto-refresh e indicador de última atualização ([65a505a](https://github.com/rafaelks1020/flixcrd/commit/65a505ad7c38fc4bfef4e3ef49f0854bd943df72))
* melhorar menu de ações do catálogo - glassmorphism, ícones, gradientes, hover effects ([2aa9c30](https://github.com/rafaelks1020/flixcrd/commit/2aa9c308fbad10c50621bd46583dde328cf55062))
* migração completa de Wasabi para Backblaze B2 com Cloudflare proxy e fallback direto ([7a6a73a](https://github.com/rafaelks1020/flixcrd/commit/7a6a73a91970ea133a6cdc7ddab06002d33a56b6))
* modulo de solicitacoes de conteudo - schema Prisma + endpoints cliente ([1782e7d](https://github.com/rafaelks1020/flixcrd/commit/1782e7d5ef96458ac8301257f86b43c64301a5ba))
* PACK GRANDÃO - atalhos teclado, busca global, bulk actions, breadcrumbs ([94c12ea](https://github.com/rafaelks1020/flixcrd/commit/94c12ea9d195803fd2a1f93a597ff149a4ca2f9c))
* PWA support for Xbox/TV - manifest, icons, gamepad navigation ([d8a0eff](https://github.com/rafaelks1020/flixcrd/commit/d8a0eff7bbccf6643f7e73fe6395619d31080b0a))
* **requests:** implement web requests module and admin workflows ([9768d6a](https://github.com/rafaelks1020/flixcrd/commit/9768d6aab6fa1aea93ef3fffd57275d8a0afb33d))
* **transcode:** add HLS jobs dashboard and async queue integration ([6db08e5](https://github.com/rafaelks1020/flixcrd/commit/6db08e564812d8f65f4214020a48f2ffa73a36ef))
* UPGRADE VISUAL COMPLETO - gradientes, glassmorphism, animações, hover effects, sidebar premium ([0f4a3b1](https://github.com/rafaelks1020/flixcrd/commit/0f4a3b1bfebf806acddb414caef78b94be09a484))


### Bug Fixes

* ABR conservador para evitar trocas frequentes de qualidade e flash da capa ([696610c](https://github.com/rafaelks1020/flixcrd/commit/696610c76537af2fec7540967c7eae3bee57aa0c))
* add array fallbacks to prevent filter/map errors on non-array API responses ([b405b17](https://github.com/rafaelks1020/flixcrd/commit/b405b17b049a0e8dcf059cc459f137b7eab8716c))
* add array safety checks to admin catalog page to prevent filter errors ([212bf6f](https://github.com/rafaelks1020/flixcrd/commit/212bf6f47e9c415c8f0177b66426c3b1240b9834))
* add CORS headers to mobile auth endpoint ([e41accb](https://github.com/rafaelks1020/flixcrd/commit/e41accb5a927e33463e5c8449aa273f1e3e267ab))
* add JWT support to all user-facing API endpoints ([6b8e4be](https://github.com/rafaelks1020/flixcrd/commit/6b8e4bef4ea3c897f6b85796ec57e208152faaaf))
* adicionar defaults em schema e corrigir build ([4544db6](https://github.com/rafaelks1020/flixcrd/commit/4544db6dde8c1c8aa79c3de17cac08dcf945a5a0))
* adjust route params typing and login page for Next 16 build ([e29e857](https://github.com/rafaelks1020/flixcrd/commit/e29e85761c4cdacf8437a44e90e8ad0539b4341f))
* ajustar renovacao de token para 2.5h (token dura 3h no Worker) ([1f4bb14](https://github.com/rafaelks1020/flixcrd/commit/1f4bb142e1742d3a016df6ffbb22263a9f5723b8))
* ajustar z-index e padding para navbar nao sobrepor conteudo ([37601da](https://github.com/rafaelks1020/flixcrd/commit/37601da818c16c8b0769e3508095fb762bb93d69))
* avoid prerendering genres api routes ([be96556](https://github.com/rafaelks1020/flixcrd/commit/be96556cdfdf44fcc67d36f2fa55620dd29088a3))
* corrigir dashboard admin - converter para client component e criar API de stats ([13a5ba2](https://github.com/rafaelks1020/flixcrd/commit/13a5ba254c8e8269e8c8b2ee875048cee3ef06fe))
* corrigir erros de lint no layout e catalog ([88d24a0](https://github.com/rafaelks1020/flixcrd/commit/88d24a0bb30e903a53521ceb076faeff5ddac3c6))
* corrigir globals.css para Tailwind v4 ([fe5596b](https://github.com/rafaelks1020/flixcrd/commit/fe5596b268afa7a0fe14c8072a2c6c8741b8e024))
* corrigir import do tailwind no globals.css para build passar ([52c4408](https://github.com/rafaelks1020/flixcrd/commit/52c4408a538f2742dd01060b4432fd07acdcca43))
* corrigir integração do HomeClient - substituir antigo pelo novo ([61b74a6](https://github.com/rafaelks1020/flixcrd/commit/61b74a6b21c7e735cf25e58e2d83d704e78acd56))
* corrigir link do catálogo no upload unificado ([416afd6](https://github.com/rafaelks1020/flixcrd/commit/416afd62d1d04495a8a2c744c90e19ab821c17db))
* corrigir tags HTML mal fechadas na página de usuários ([7b0431e](https://github.com/rafaelks1020/flixcrd/commit/7b0431e2ab66b25d0ed84b75f2e9ab222a0e0cc3))
* CORRIGIR TAILWIND COMPLETAMENTE - adicionar config e autoprefixer ([9c75904](https://github.com/rafaelks1020/flixcrd/commit/9c75904466bd89107816ee566783a7f489ff1877))
* corrigir verificação de status do Cloudflare nas ações rápidas ([f92ab4b](https://github.com/rafaelks1020/flixcrd/commit/f92ab4bde045ab9ded94914eeb6ad5a766586aad))
* deploy workflow secret handling ([c70c030](https://github.com/rafaelks1020/flixcrd/commit/c70c0308a52ec5114418e931d4201fcfef956d18))
* evitar multiplas buscas de progresso que causavam loop de reload ([3195e04](https://github.com/rafaelks1020/flixcrd/commit/3195e04c0a9184b8d2602800b4dca127c565e268))
* HLS variant playlists for episodes + profile stale state handling + admin settings API + maintenance mode ([506e001](https://github.com/rafaelks1020/flixcrd/commit/506e001b071a0f8be68dcc19b28bf02ddf0f6c0c))
* lint cleanup - 0 erros, config ESLint otimizado, tipagem melhorada ([3bdda2d](https://github.com/rafaelks1020/flixcrd/commit/3bdda2defc337e7318bdb9d4173261b897685c13))
* PWA with Service Worker for Xbox Edge compatibility ([1f9d544](https://github.com/rafaelks1020/flixcrd/commit/1f9d544247a0017d43c00bca9dec705eae28d3bb))
* removing accidental api key leak ([027aa37](https://github.com/rafaelks1020/flixcrd/commit/027aa37e2864738f07e4949b20fe16485bd7b196))
* renovacao de token silenciosa sem interromper playback ([e4a8029](https://github.com/rafaelks1020/flixcrd/commit/e4a802905977b617b2b72b0517704e3ed5761cae))
* replace mocked data with real API data in analytics and logs ([e4b9a0e](https://github.com/rafaelks1020/flixcrd/commit/e4b9a0e677908dc10508b465424b10563d7abfdd))
* return paginated response from /api/titles endpoint ([ed93d94](https://github.com/rafaelks1020/flixcrd/commit/ed93d94359f4ac48e12ef28394121e0a9d9c4ea1))
* run prisma generate on vercel build ([7d72f64](https://github.com/rafaelks1020/flixcrd/commit/7d72f6499dc435984f82e06ba8e77ef7864d4650))
* substituir TODAS as páginas antigas pelas novas ([803dff3](https://github.com/rafaelks1020/flixcrd/commit/803dff3e1c80e6be1a825134200c38576198c2b1))
* usar sintaxe Tailwind v4 correta com [@import](https://github.com/import) ([a1fad2e](https://github.com/rafaelks1020/flixcrd/commit/a1fad2e5672405d829391c750bad05fc2b7f9405))
* use getAuthUser for JWT support in playback endpoints ([3f31f32](https://github.com/rafaelks1020/flixcrd/commit/3f31f32f768f48f55a8d77ab9ebb94b3a29145e5))


### Performance Improvements

* otimizar catálogo - reduzir de 110+ requests para apenas 2 usando batch API ([af4fb87](https://github.com/rafaelks1020/flixcrd/commit/af4fb8719289e306763cf89fc7d66cd06f30ec73))

## 0.1.0

### Usuário final

- Recuperação de senha por email.
- Emails de pagamento mais claros (PIX com QR + copia-e-cola; boleto com link; cartão aprovado com confirmação).
- Legendas no player web (faixas VTT) e melhorias no playback.

### Admin / Operação

- Painel admin com melhorias de estabilidade, tipagem e correções de lint.
- Monitoramento/Status mais realistas (serviços, cache, etc).
- Fluxos de legendas e upload v2 com automações.
