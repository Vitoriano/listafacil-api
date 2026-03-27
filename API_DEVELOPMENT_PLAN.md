# Plano de Desenvolvimento da API — Lista Fácil

## Contexto

O app mobile Lista Fácil está funcional com dados mock. Precisamos projetar a API REST e o banco de dados relacional (PostgreSQL) que suportará todas as funcionalidades. Restrição principal: **produtos são globais** (catálogo único, não segmentado por loja). Preços são os dados por loja, submetidos por usuários (crowdsourced).

---

## 1. Modelagem do Banco de Dados (PostgreSQL)

### 1.1 Extensions necessárias

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- IDs UUID
CREATE EXTENSION IF NOT EXISTS "postgis";      -- Geolocalização (getNearby)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- Busca fuzzy (typo tolerance)
CREATE EXTENSION IF NOT EXISTS "unaccent";     -- "açúcar" = "acucar"
```

### 1.2 Enums

```sql
CREATE TYPE product_category AS ENUM (
  'fruits','vegetables','dairy','meat','bakery',
  'beverages','cleaning','hygiene','snacks','grains','frozen','other'
);
CREATE TYPE store_type AS ENUM ('supermarket','hypermarket','convenience','wholesale');
CREATE TYPE purchase_status AS ENUM ('active','completed','cancelled');
CREATE TYPE share_role AS ENUM ('editor','viewer');
```

### 1.3 Tabelas

#### users
```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(320) NOT NULL UNIQUE,
  password_hash VARCHAR(256) NOT NULL,
  avatar_url    TEXT,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_users_email ON users (lower(email));
```
- `totalSubmissions` e `totalSavings` são **derivados** (materialized view), não colunas.

#### products (GLOBAL — catálogo único)
```sql
CREATE TABLE products (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(300) NOT NULL,
  brand      VARCHAR(200) NOT NULL,
  barcode    VARCHAR(50) NOT NULL UNIQUE,
  category   product_category NOT NULL DEFAULT 'other',
  unit       VARCHAR(50) NOT NULL,
  image_url  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_products_barcode ON products (barcode);
CREATE INDEX idx_products_category_name ON products (category, name);
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX idx_products_brand_trgm ON products USING gin (brand gin_trgm_ops);
```
- `averagePrice`, `lowestPrice`, `priceCount` → materialized view `product_price_stats`
- `idx_products_barcode`: caminho crítico do scanner, deve ser sub-ms
- `gin_trgm_ops`: busca fuzzy com tolerância a typos e acentos

#### stores
```sql
CREATE TABLE stores (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name      VARCHAR(300) NOT NULL,
  address   VARCHAR(500) NOT NULL,
  city      VARCHAR(200) NOT NULL,
  state     CHAR(2) NOT NULL,
  location  geography(Point, 4326) NOT NULL,
  type      store_type NOT NULL DEFAULT 'supermarket',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stores_location ON stores USING gist (location);
CREATE INDEX idx_stores_city_state ON stores (state, city);
```
- PostGIS `geography` para distância geodésica real (Brasil = 8.5M km²)
- GiST index para `ST_DWithin` + KNN ordering

#### prices (crowdsourced)
```sql
CREATE TABLE prices (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  price        NUMERIC(8,2) NOT NULL CHECK (price BETWEEN 0.01 AND 99999.99),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_valid     BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_prices_product_submitted ON prices (product_id, submitted_at DESC);
CREATE INDEX idx_prices_product_store ON prices (product_id, store_id, submitted_at DESC);
CREATE INDEX idx_prices_user ON prices (user_id, submitted_at DESC);
CREATE INDEX idx_prices_valid ON prices (product_id, is_valid) WHERE is_valid = true;
```

#### price_validations (voto individual, sem counter)
```sql
CREATE TABLE price_validations (
  id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  price_id UUID NOT NULL REFERENCES prices(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_valid BOOLEAN NOT NULL,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (price_id, user_id)
);
```
- UNIQUE previne voto duplo e evita race condition de counter

#### shopping_lists
```sql
CREATE TABLE shopping_lists (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(200) NOT NULL,
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lists_owner ON shopping_lists (owner_id, updated_at DESC);
```

#### list_items
```sql
CREATE TABLE list_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id         UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  estimated_price NUMERIC(8,2) NOT NULL DEFAULT 0,
  checked         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (list_id, product_id)
);
CREATE INDEX idx_list_items_list ON list_items (list_id);
```
- `productName` e `unit` vêm via JOIN (evita stale data)
- UNIQUE impede duplicatas mesmo com requests concorrentes

#### list_members
```sql
CREATE TABLE list_members (
  list_id   UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      share_role NOT NULL DEFAULT 'viewer',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, user_id)
);
CREATE INDEX idx_list_members_user ON list_members (user_id);
```

#### list_invites
```sql
CREATE TABLE list_invites (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id    UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email      VARCHAR(320),
  role       share_role NOT NULL DEFAULT 'viewer',
  accepted   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);
CREATE INDEX idx_list_invites_list ON list_invites (list_id) WHERE NOT accepted;
```

#### purchases
```sql
CREATE TABLE purchases (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE SET NULL,
  linked_list_id UUID REFERENCES shopping_lists(id) ON DELETE SET NULL,
  status         purchase_status NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ
);
CREATE INDEX idx_purchases_user ON purchases (user_id, created_at DESC);
CREATE INDEX idx_purchases_user_completed ON purchases (user_id, completed_at DESC) WHERE status = 'completed';
```
- `total`, `itemCount`, `storeName`, `date` são derivados (SUM/COUNT/JOIN)

#### purchase_items
```sql
CREATE TABLE purchase_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id  UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE SET NULL,
  barcode      VARCHAR(50) NOT NULL,
  price        NUMERIC(8,2) NOT NULL CHECK (price >= 0.01),
  quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  from_list_id UUID REFERENCES shopping_lists(id) ON DELETE SET NULL
);
CREATE INDEX idx_purchase_items_purchase ON purchase_items (purchase_id);
```
- `barcode` redundante por design: sobrevive à deleção do produto

### 1.4 Materialized Views

#### product_price_stats (refresh a cada 5 min via pg_cron)
```sql
CREATE MATERIALIZED VIEW product_price_stats AS
SELECT p.id AS product_id,
  COALESCE(ROUND(AVG(pr.price)::numeric, 2), 0) AS average_price,
  COALESCE(MIN(pr.price), 0) AS lowest_price,
  COUNT(pr.id) AS price_count
FROM products p
LEFT JOIN prices pr ON pr.product_id = p.id AND pr.is_valid = true
GROUP BY p.id;

CREATE UNIQUE INDEX idx_pps_product ON product_price_stats (product_id);
```

#### user_stats (refresh a cada 15 min)
```sql
CREATE MATERIALIZED VIEW user_stats AS
SELECT u.id AS user_id,
  COUNT(DISTINCT pr.id) AS total_submissions,
  COALESCE(SUM(
    GREATEST(pps.average_price - pi.price, 0) * pi.quantity
  ), 0) AS total_savings
FROM users u
LEFT JOIN prices pr ON pr.user_id = u.id
LEFT JOIN purchases p ON p.user_id = u.id AND p.status = 'completed'
LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
LEFT JOIN product_price_stats pps ON pps.product_id = pi.product_id
GROUP BY u.id;

CREATE UNIQUE INDEX idx_user_stats_user ON user_stats (user_id);
```

---

## 2. API REST — Endpoints Completos

**Base URL:** `https://api.listafacil.com.br/v1`
**Auth:** Bearer JWT no header `Authorization`
**Paginação:** `?page=1&limit=20` → `{ data, total, page, limit, hasMore }`

### Auth (sem autenticação)
| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| POST | `/auth/register` | `{name, email, password}` | `{user, token}` 201 |
| POST | `/auth/login` | `{email, password}` | `{user, token}` 200 |
| POST | `/auth/refresh` | Bearer refresh token | `{token, refreshToken}` 200 |

### Users (autenticado)
| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| GET | `/users/me` | — | `User` com stats |
| PATCH | `/users/me` | `{name?, email?, avatarUrl?}` | `User` atualizado |
| GET | `/users/me/savings` | — | `{totalSavings, monthlySavings[], recentPurchases[]}` |

### Products (autenticado)
| Método | Rota | Query/Corpo | Resposta |
|--------|------|-------------|----------|
| GET | `/products` | `?search&category&sortBy&page&limit` | `Paginated<Product>` |
| GET | `/products/:id` | — | `Product` |
| GET | `/products/barcode/:barcode` | — | `Product` ou 404 |
| POST | `/products` | `{name, brand, barcode, category, unit}` | `Product` 201 |

### Prices (autenticado)
| Método | Rota | Query/Corpo | Resposta |
|--------|------|-------------|----------|
| GET | `/products/:productId/prices` | `?page&limit` | `Paginated<PriceEntry>` |
| GET | `/products/:productId/prices/comparison` | — | `PriceComparison` |
| GET | `/products/:productId/prices/history` | `?storeId` | `PriceHistoryPoint[]` |
| POST | `/products/:productId/prices` | `{storeId, price}` | `PriceEntry` 201 |
| POST | `/prices/:priceId/validate` | `{isValid}` | 204 |

### Stores (autenticado)
| Método | Rota | Query | Resposta |
|--------|------|-------|----------|
| GET | `/stores` | — | `Store[]` |
| GET | `/stores/:id` | — | `Store` |
| GET | `/stores/nearby` | `?lat&lng&radiusKm` | `Store[]` com `distance` |

### Shopping Lists (autenticado, com controle de acesso)
| Método | Rota | Corpo | Resposta | Quem pode |
|--------|------|-------|----------|-----------|
| GET | `/lists` | — | `ShoppingList[]` | owner + membro |
| POST | `/lists` | `{name}` | `ShoppingList` 201 | qualquer user |
| GET | `/lists/:id` | — | `ShoppingList` com items | owner + membro |
| PATCH | `/lists/:id` | `{name?}` | `ShoppingList` | owner + editor |
| DELETE | `/lists/:id` | — | 204 | owner only |
| POST | `/lists/:id/items` | `{productId, quantity}` | `ListItem` 201 | owner + editor |
| PATCH | `/lists/:id/items/:itemId` | `{quantity?, checked?}` | `ListItem` | owner + editor |
| DELETE | `/lists/:id/items/:itemId` | — | 204 | owner + editor |
| GET | `/lists/:id/optimize` | — | `OptimizationResult` | owner + membro |
| GET | `/lists/:id/members` | — | `SharedMember[]` | owner + membro |
| POST | `/lists/:id/share/email` | `{email, role}` | `ShareResult` | owner + editor |
| POST | `/lists/:id/share/invite` | `{role}` | `ShareResult` | owner + editor |
| DELETE | `/lists/:id/members/:userId` | — | 204 | owner (ou self) |
| GET | `/invites/:inviteId` | — | `ShareInvite` | **sem auth** |
| POST | `/invites/:inviteId/join` | — | `ShoppingList` | autenticado |

### Purchases / Carrinho (autenticado, owner only)
| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| GET | `/purchases` | `?page&limit` | `Paginated<Purchase>` |
| GET | `/purchases/recent` | `?limit` | `Purchase[]` (completed) |
| POST | `/purchases` | `{storeId, linkedListId?}` | `Purchase` 201 (status=active) |
| GET | `/purchases/:id` | — | `Purchase` com items |
| PATCH | `/purchases/:id` | `{status}` | `Purchase` (side-effect: ao completar, submete preços) |
| POST | `/purchases/:id/items` | `{productId, barcode, price, quantity, fromListId?}` | `PurchaseItem` 201 |
| PATCH | `/purchases/:id/items/:itemId` | `{quantity}` | `PurchaseItem` |
| DELETE | `/purchases/:id/items/:itemId` | — | 204 |

---

## 3. Trade-offs e Decisões Arquiteturais

### 3.1 Campos computados (averagePrice, lowestPrice)
- **Decisão:** Materialized view com refresh a cada 5 min (pg_cron + CONCURRENTLY)
- **Trade-off:** Staleness de até 5 min vs. latência de 50-200ms por query ao vivo
- **Por quê:** Tela de produtos carrega 20 items, cada um precisa de stats. JOIN com MV = <1ms. Usuário fazendo compras não precisa de preço atualizado em real-time ao segundo

### 3.2 Validação de preços — modelo de confiança
- **Decisão:** Votos individuais em `price_validations` (não counter)
- **Regra:** Preço válido se upvotes/total ≥ 60% OU total_votes < 3
- **Auto-expiração:** Preços > 30 dias marcados `is_valid = false` (cron noturno)
- **Trade-off:** Preços novos são confiáveis por padrão até prova contrária
- **Por quê:** Inflação brasileira e promoções tornam preços velhos mais nocivos que preços não validados

### 3.3 Algoritmo de otimização de lista
- **Complexidade:** O(S × I) onde S = lojas com preços, I = itens da lista
- **Para 20 itens × 50 lojas = 1000 lookups indexados → <50ms
- **Trade-off futuro:** Multi-store optimization (comprar itens 1-3 na loja A, 4-6 na B) é NP-hard, solvível com greedy para listas pequenas

### 3.4 Geolocalização
- **Decisão:** PostGIS `geography` + GiST index
- **Trade-off:** Dependência de extensão vs. Haversine em app-level
- **Por quê:** Brasil = 35° de latitude, aproximação flat-earth quebra. PostGIS `ST_DWithin` + KNN usa o index, Haversine faz full table scan

### 3.5 Paginação
- **Decisão:** Offset-based (matches `Paginated<T>` existente no app)
- **Trade-off:** Performance degrada em offsets altos vs. complexidade de cursor
- **Por quê:** Catálogo <100K produtos, usuário raramente passa da página 5

### 3.6 Barcode não encontrado
- **Decisão:** 404 + fluxo de criação pelo usuário (`POST /products`)
- **Trade-off:** Dependência de crowdsource vs. API externa de barcodes
- **Por quê:** Bancos de barcode gratuitos (Open Food Facts, Cosmos) têm cobertura ruim para produtos brasileiros

### 3.7 Colaboração em tempo real nas listas
- **Decisão:** Short polling 10s via React Query `refetchInterval` (v1)
- **Trade-off:** Latência de ~10s vs. complexidade de WebSocket
- **Por quê:** Lista de compras não é Google Docs — 10s de delay é aceitável. Upgrade para WebSocket no v2

### 3.8 Busca de produtos
- **Decisão:** pg_trgm + unaccent (PostgreSQL nativo)
- **Trade-off:** Sem ranking sofisticado vs. Elasticsearch/Meilisearch
- **Por quê:** <100K produtos, busca fuzzy + accent-safe resolve. Sem infra adicional

### 3.9 Retenção de histórico de preços
- **Decisão:** 12 meses raw, depois agrega em médias diárias
- **~20M rows/ano para 10K produtos → gerenciável com indexes

---

## 4. Performance

### Cache (Redis)
| Chave | TTL | Quando invalidar |
|-------|-----|-----------------|
| `product:{id}` | 1h | Update do produto |
| `products:search:{hash}` | 5min | Refresh da MV |
| `stores:all` | 24h | Create/update de store |
| `stores:nearby:{lat}:{lng}:{r}` | 30min | Create de store |
| `prices:comparison:{productId}` | 5min | Novo preço submetido |
| `user:{id}:stats` | 15min | Submit de preço ou compra finalizada |
| Listas: **NÃO cachear** | — | Edição colaborativa exige dados frescos |

### Rate Limiting (Redis sliding window)
| Endpoint | Limite | Janela |
|----------|--------|--------|
| `POST /auth/login` | 5 | 15 min |
| `POST /auth/register` | 3 | 1 hora |
| `POST /products/:id/prices` | 30 | 1 hora |
| `POST /prices/:id/validate` | 60 | 1 hora |
| `POST /products` | 10 | 1 hora |
| Demais autenticados | 120 | 1 min |

### N+1 Prevention
- Product list: `LEFT JOIN product_price_stats`
- List items: `JOIN products` em batch (1 query, não N)
- Price entries: `JOIN stores` para storeName
- Purchases: `JOIN stores` + sub-query para items

### Connection Pooling
- PgBouncer transaction mode, pool de 20 conexões

### Imagens
- Upload via presigned URL (S3/R2) → Lambda resize → CDN (CloudFront)

---

## 5. Segurança

### JWT
- **Access token:** 15 min, RS256, stateless
- **Refresh token:** 30 dias, opaque, stored em `refresh_tokens` table
- **Storage mobile:** Access em memória (Zustand), refresh em `expo-secure-store`

### Autorização
| Recurso | Quem pode |
|---------|-----------|
| Products/Prices/Stores | Qualquer autenticado (leitura e escrita) |
| Shopping List CRUD | Owner + editors |
| Shopping List leitura | Owner + membros (viewers) |
| List delete + remove members | Owner only |
| Purchases | Owner only |
| Validar preço | Qualquer autenticado, exceto quem submeteu |

### Validação de Input
- Zod server-side (mesmos schemas do app)
- Parameterized queries (sem interpolação SQL)
- Barcode: 8-14 dígitos
- Price: `[0.01, 99999.99]` (PRICE_MIN/PRICE_MAX do `constants.ts`)
- Pagination: `page >= 1`, `limit in [1, 50]`

---

## 6. Arquivos de referência do app

| Arquivo | Relevância |
|---------|-----------|
| `src/data/repositories/interfaces/*.ts` | Contratos que viram endpoints |
| `src/features/*/types.ts` | Shapes de request/response |
| `src/features/*/schemas/*.ts` | Validações Zod para reusar server-side |
| `src/data/repositories/mock/*.ts` | Implementação de referência da lógica |
| `src/features/cart/stores/cartStore.ts` | State machine do fluxo de compra |
| `src/config/constants.ts` | PRICE_MIN, PRICE_MAX, PAGINATION_LIMIT |

---

## 7. Verificação

- [ ] Cada método de interface em `src/data/repositories/interfaces/` tem endpoint correspondente
- [ ] Todos os query keys do React Query (`['products', params]`, `['prices', productId, 'comparison']`, etc.) mapeiam para exatamente 1 endpoint
- [ ] Cada Zod schema em `src/features/*/schemas/` tem equivalente na validação server-side
- [ ] Rodar `npx tsc --noEmit` após criar os `Api*Repository` que substituem os `Mock*Repository`
- [ ] Testar fluxo completo: login → escanear barcode → produto mock retornado → adicionar ao carrinho → finalizar → compra aparece no histórico
