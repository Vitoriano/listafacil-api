# Deploy (produção)

Padrão **GitHub Actions → GHCR → Dokploy**, igual ao ms-sicredi. São **dois stacks
separados** no Dokploy: `listafacil-api` (NestJS) e `listafacil-redis` (cache). Eles se
enxergam pela rede `dokploy-network`, criada pelo próprio Dokploy. O Postgres fica no Neon.

```
push → production
  ├─ migrate          # prisma migrate deploy, secrets.DATABASE_URL
  ├─ build-and-push   # Dockerfile target `production` → ghcr.io/vitoriano/listafacil-api
  └─ deploy           # POST no webhook do Dokploy (pula se o secret estiver vazio)
```

- Trigger: push na branch `production` (ou `workflow_dispatch`). **Não** há deploy automático a partir de `main`.
- Migrations rodam **no CI**, nunca no `CMD` do container.
- Seed de categorias é só para desenvolvimento. Em produção, rode uma vez localmente
  com `DATABASE_URL` apontando para o banco de prod: `npm run db:seed` (idempotente).
- Arquivos: [.github/workflows/production.yml](.github/workflows/production.yml),
  [deploy/dokploy/api/docker-compose.yml](deploy/dokploy/api/docker-compose.yml),
  [deploy/dokploy/redis/docker-compose.yml](deploy/dokploy/redis/docker-compose.yml),
  [Dockerfile](Dockerfile) (stage `production`).

## Secrets no GitHub (Settings → Secrets → Actions)

| Secret | Uso |
|---|---|
| `DATABASE_URL` | Obrigatório — job `migrate`. Pode ser a URL pooled: o workflow remove `-pooler` do host para rodar as migrations no endpoint direto. |
| `DOKPLOY_WEBHOOK_URL` | Opcional — redeploy do stack no Dokploy |

## Env no Dokploy

### Stack `listafacil-redis`

| Variável | Obrigatória | Descrição |
|---|---|---|
| `REDIS_PASSWORD` | sim | Senha do Redis. A rede `dokploy-network` é compartilhada com outros apps do servidor, por isso o Redis não roda aberto. |

O container tem o alias fixo `listafacil-redis` na rede. Sem domínio e sem portas publicadas.

### Stack `listafacil-api`

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | URL pooled do Neon, com `?sslmode=require` |
| `REDIS_URL` | sim | `redis://:<REDIS_PASSWORD>@listafacil-redis:6379` |
| `JWT_PRIVATE_KEY_B64` | sim | PEM da chave privada RSA em base64 (uma linha) |
| `JWT_PUBLIC_KEY_B64` | sim | PEM da chave pública RSA em base64 (uma linha) |
| `JWT_ACCESS_EXPIRATION` | não | Padrão `15m` |
| `JWT_REFRESH_EXPIRATION_DAYS` | não | Padrão `30` |
| `IMAGE_TAG` | não | Padrão `latest` |

`PORT` e `NODE_ENV` já estão fixos no compose.

### Gerar chaves JWT de produção

Use um par **diferente** do de desenvolvimento. O app aceita o PEM em base64
(`*_B64`), o que evita valores multilinha no painel de env.

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt.key
openssl rsa -in jwt.key -pubout -out jwt.pub

echo "JWT_PRIVATE_KEY_B64=$(base64 -i jwt.key | tr -d '\n')"
echo "JWT_PUBLIC_KEY_B64=$(base64 -i jwt.pub | tr -d '\n')"

rm jwt.key jwt.pub
```

Em Linux troque `base64 -i` por `base64 -w0`.

## Primeiro deploy

1. Criar o stack **do Redis** no Dokploy (**Create Service → Compose**, provider GitHub,
   branch `production`, compose path `./deploy/dokploy/redis/docker-compose.yml`), definir
   `REDIS_PASSWORD` e fazer o deploy. Esse stack quase nunca muda; não precisa de webhook.
2. Criar o stack **da API** (mesmo fluxo, compose path `./deploy/dokploy/api/docker-compose.yml`),
   preencher o Env (incluindo `REDIS_URL` com a senha do passo 1) e o domínio
   (serviço `api`, porta `3000`, HTTPS ligado); copiar a URL do webhook de redeploy.
3. Tornar o package `ghcr.io/vitoriano/listafacil-api` público (ou cadastrar credenciais do GHCR no Dokploy).
4. Configurar os secrets no GitHub e criar a branch `production` a partir de `main`.
5. `git push origin production` — acompanhar em Actions → *Deploy to PROD*.

## Verificar

- Health: `https://<dominio>/v1/health` → `{"status":"ok", ...}`
- Swagger: `https://<dominio>/api/docs`
- Logs: aba **Logs** do serviço no Dokploy.

## Notas

- O Redis usa `appendonly` com volume `redis-data`, `allkeys-lru` e 256 MB, com senha
  (`--requirepass`). Não publica portas: só a API o alcança, pela `dokploy-network`.
- Redeploy da API não reinicia o Redis, e vice-versa, porque são stacks independentes.
- Rate limit: 120 req/min por IP. O `trust proxy` está ligado no `main.ts` para o IP real
  chegar pelo Traefik.
- Socket.IO funciona no mesmo domínio, sem configuração extra no Dokploy.
