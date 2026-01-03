# Logging Guide - FlixCRD

## Overview

O FlixCRD utiliza Winston para logging estruturado, fornecendo visibilidade completa das operações do sistema.

## Níveis de Log

- **error**: Erros críticos, exceções não tratadas
- **warn**: Avisos, operações lentas (>1s), deprecations
- **info**: Eventos importantes, chamadas de API, autenticação
- **debug**: Detalhes de desenvolvimento (desabilitado em produção)

## Estrutura dos Logs

### Formato JSON
```json
{
  "timestamp": "2025-12-30 13:36:00",
  "level": "info",
  "message": "API Call",
  "method": "GET",
  "url": "/api/titles",
  "userId": "user123",
  "duration": 150,
  "service": "flixcrd-web",
  "version": "0.2.0"
}
```

### Arquivos de Log
- `logs/error.log` - Apenas erros (5MB max, 5 arquivos)
- `logs/combined.log` - Todos os logs (5MB max, 10 arquivos)
- `logs/exceptions.log` - Exceções não capturadas
- `logs/rejections.log` - Rejeições de Promise

## Funções Helper

### logError
```typescript
import { logError } from '@/lib/logger'

logError('Database connection failed', error, { 
  userId: '123', 
  operation: 'user_login' 
})
```

### logApiCall
```typescript
import { logApiCall } from '@/lib/logger'

logApiCall('POST', '/api/auth/register', userId, duration)
```

### logPerformance
```typescript
import { logPerformance } from '@/lib/logger'

logPerformance('database_query', duration, { 
  query: 'SELECT * FROM users' 
})
```

## Configuração

### Variáveis de Ambiente
```bash
LOG_LEVEL=info          # Nível mínimo de log
NODE_ENV=production    # Ambiente (afeta formatação)
```

### Configuração de Produção
```typescript
// Em produção, logs são apenas em arquivo
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }))
}
```

## Troubleshooting

### Logs Não Aparecendo
1. Verificar se diretório `logs/` existe
2. Confirmar permissões de escrita
3. Verificar `LOG_LEVEL` apropriado

### Performance Impact
- Overhead: <5ms por log
- Logs assíncronos (não bloqueiam)
- Rotação automática de arquivos

### Logs em Docker
```yaml
volumes:
  - ./logs:/app/logs
```

## Monitoramento

### Health Check com Logs
O endpoint `/api/health` inclui métricas de performance nos logs.

### Exemplo de Monitoramento
```bash
# Verificar erros recentes
tail -f logs/error.log | jq '.level == "error"'

# Monitorar performance
grep "Performance Metric" logs/combined.log | jq '.duration > 1000'
```

## Best Practices

1. **Contexto Sempre**: Incluir userId, operation, etc.
2. **Dados Sensíveis**: Mascarar passwords, tokens
3. **Performance**: Usar `logPerformance` para operações lentas
4. **Erros**: Sempre incluir stack trace completo
5. **APIs**: Logar todas as chamadas com duração

## Exemplo Completo

```typescript
// Em uma API route
import { logger, logApiCall, logError } from '@/lib/logger'

export async function GET(request: Request) {
  const startTime = Date.now()
  const userId = await getCurrentUser(request)
  
  try {
    const data = await prisma.user.findMany()
    
    logApiCall('GET', '/api/users', userId, Date.now() - startTime)
    logger.info('Users fetched successfully', { count: data.length })
    
    return NextResponse.json(data)
  } catch (error) {
    logError('Failed to fetch users', error as Error, { userId })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## Integração com Monitoring Futuro

Este logger está preparado para integração com:
- **Prometheus**: Métricas de performance
- **Sentry**: Error tracking
- **ELK Stack**: Centralização de logs
- **Grafana**: Dashboards de monitoring
