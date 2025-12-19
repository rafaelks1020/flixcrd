---
description: Processo de versionamento e releases (SemVer + changelog automático)
---

# Versionamento e Releases (flixcrd-web)

Este projeto usa:

- **SemVer**: `MAJOR.MINOR.PATCH` (ex: `1.2.3`)
- **Conventional Commits** para derivar a versão automaticamente
- **Release Please** (GitHub Actions) para gerar:
  - PR de release
  - bump de versão em `package.json`
  - `CHANGELOG.md`
  - tag `vX.Y.Z` + GitHub Release

## Padrão de commits (obrigatório para versionamento automático)

Use um destes prefixos:

- `feat: ...` => **minor**
- `fix: ...` => **patch**
- `perf: ...` => **patch**
- `chore: ...` / `docs: ...` / `refactor: ...` / `test: ...` => normalmente não gera bump (ou entra como manutenção)

Breaking change:

- `feat!: ...` ou `fix!: ...`
- ou incluir no corpo do commit: `BREAKING CHANGE: ...`

### Como isso vira versão (SemVer)

- **Patch** (`X.Y.Z` -> `X.Y.(Z+1)`)
  - Quando você usar `fix:` (ou `perf:`)
  - Exemplo: `fix: corrigir login quando token expira`
- **Minor** (`X.Y.Z` -> `X.(Y+1).0`)
  - Quando você usar `feat:`
  - Exemplo: `feat: adicionar filtro por gênero no catálogo`
- **Major** (`X.Y.Z` -> `(X+1).0.0`)
  - Quando for uma mudança incompatível (breaking)
  - Use `!` no tipo (`feat!:` / `fix!:`) ou `BREAKING CHANGE:` no corpo
  - Exemplo: `feat!: alterar contrato do endpoint /api/payments`

### Boas práticas (pra não “quebrar” o bump)

- O **commit que entra no `main`** é o que conta para o Release Please.
- Se você usa **Squash & merge**, o commit final usa o **título da PR**. Então escreva o título da PR no padrão `feat:` / `fix:`.
- Para mudanças grandes, prefira **PR com título certo** e commits internos livres (o importante é o squash final).

## Como soltar uma versão

1. Faça merge de changes no branch `main` (ideal: squash merge com título no padrão above).
2. O workflow **Release Please** vai abrir uma PR automaticamente (ex: `chore(main): release v0.1.1`).
3. Revise a PR (changelog + bump) e faça merge.
4. Ao mergear a PR de release, o GitHub vai criar:
   - tag `vX.Y.Z`
   - GitHub Release

### Pré-requisito no GitHub (pra PR de release funcionar)

Se o Release Please não conseguir criar a PR automaticamente, habilite:

Repo -> **Settings** -> **Actions** -> **General** -> **Workflow permissions**:

- **Read and write permissions**
- **Allow GitHub Actions to create and approve pull requests**

## Dicas práticas

- Se você usa **squash merge**, o *commit final* vira o título da PR: então deixe o título no formato `feat: ...` / `fix: ...`.
- Para hotfix urgente: crie um commit `fix: ...` e merge em `main`.

## Como validar qual versão está no ar (produção)

O deploy na Vercel fica rastreável via endpoint:

- `GET /api/version`

Ele retorna, por exemplo:

```json
{
  "name": "flixcrd-web",
  "version": "0.1.0",
  "commitSha": "...",
  "deploymentId": "...",
  "region": "...",
  "serverTime": "..."
}
```

Use isso para conferir rapidamente se o deploy atual bate com o release/tag esperado.

## Redeploy manual (quando precisar)

O repositório tem um workflow de redeploy manual via **Vercel Deploy Hook**.
Ele é intencionalmente **manual** para evitar deploy duplicado (o deploy automático normal vem da integração Git da Vercel no push do `main`).

