# FlixCRD Web Platform

Plataforma de streaming completa com Next.js, TypeScript, e Prisma.

## 🚀 Features

- **Streaming HLS**: Player de vídeo com suporte a múltiplas qualidades
- **Autenticação**: Sistema completo com NextAuth
- **Admin Panel**: Gestão de conteúdo e usuários
- **Transcoder**: Serviço de conversão de vídeo para HLS
- **Mobile App**: Aplicativo React Native companion

## 📋 Pré-requisitos

- Node.js 18+
- PostgreSQL 15+
- Redis (opcional, para cache)
- Docker & Docker Compose (recomendado)

## 🛠️ Setup Rápido

### 1. Clone o repositório
```bash
git clone <repository-url>
cd flixcrd-web
```

### 2. Configure as variáveis de ambiente
```bash
cp .env.example .env
# Edite .env com suas credenciais
```

### 3. Instale as dependências
```bash
npm install
```

### 4. Configure o banco de dados
```bash
# Gere o Prisma client
npm run prisma:generate

# Rode as migrations (se necessário)
npm run prisma:migrate

# Popule o banco com dados iniciais
npm run prisma:seed
```

### 5. Inicie o desenvolvimento
```bash
npm run dev
```

Acesse http://localhost:3000

## 🐳 Docker Setup

### Development
```bash
docker-compose up -d
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 🧪 Testes

```bash
# Rodar todos os testes
npm test

# Rodar com coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 📊 Estrutura do Projeto

```
src/
├── app/                 # App Router (Next.js 13+)
│   ├── api/            # API routes
│   ├── admin/          # Admin panel
│   └── (auth)/         # Auth pages
├── components/         # React components
├── lib/               # Utilities e configs
├── __tests__/         # Test files
└── middleware.ts      # Next.js middleware
```

## 🔧 Variáveis de Ambiente

Veja `.env.example` para todas as variáveis necessárias:

- **Database**: PostgreSQL connection string
- **Auth**: NextAuth configuration
- **Storage**: Wasabi S3 credentials
- **External APIs**: TMDB, OpenSubtitles
- **Push Notifications**: VAPID keys

## 🚀 Deploy

### Vercel (Recomendado)
```bash
# Instale Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Docker
```bash
# Build image
docker build -t flixcrd-web .

# Run container
docker run -p 3000:3000 flixcrd-web
```

## 📈 Monitoramento

- **Health Check**: `/api/health`
- **Logs**: Estruturados com Winston
- **Metrics**: Prometheus endpoint (se configurado)

## 🔒 Segurança

- **Helmet**: Headers de segurança
- **Rate Limiting**: Proteção contra abuse
- **Input Validation**: Zod schemas
- **Audit Trail**: Logs de ações sensíveis

## 📚 Documentação

- [API Docs](./docs/api/) - Documentação das APIs
- [Architecture](./docs/architecture/) - Arquitetura do sistema
- [Operations](./docs/ops/) - Guias operacionais

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma feature branch (`git checkout -b feature/amazing-feature`)
3. Commit suas mudanças (`git commit -m 'Add amazing feature'`)
4. Push para a branch (`git push origin feature/amazing-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob licença privada.
