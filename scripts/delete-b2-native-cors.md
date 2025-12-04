# Como deletar CORS Native do B2

## Opção 1: Via Interface Web (RECOMENDADO)

1. Acesse https://secure.backblaze.com/b2_buckets.htm
2. Clique no bucket `paelflix`
3. Vá em **Bucket Settings**
4. Role até **CORS Rules**
5. **Delete todas as regras CORS**
6. Salve

## Opção 2: Via CLI (se tiver instalado)

```bash
b2 update-bucket paelflix allPrivate --corsRules '[]'
```

---

Depois de deletar, rode:

```bash
npx tsx scripts/setup-b2-cors.ts
```

Para configurar CORS via S3 API (compatível com uploads).
