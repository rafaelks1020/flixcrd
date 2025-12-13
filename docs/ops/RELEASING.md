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

## Como soltar uma versão

1. Faça merge de changes no branch `main` (ideal: squash merge com título no padrão above).
2. O workflow **Release Please** vai abrir uma PR automaticamente (ex: `chore(main): release v0.1.1`).
3. Revise a PR (changelog + bump) e faça merge.
4. Ao mergear a PR de release, o GitHub vai criar:
   - tag `vX.Y.Z`
   - GitHub Release

## Dicas práticas

- Se você usa **squash merge**, o *commit final* vira o título da PR: então deixe o título no formato `feat: ...` / `fix: ...`.
- Para hotfix urgente: crie um commit `fix: ...` e merge em `main`.

