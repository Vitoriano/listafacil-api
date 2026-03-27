# Tech Spec: Lista Fácil Backend API - Technical Specification

> Complete technical specification for the Lista Fácil NestJS REST API with PostgreSQL (Prisma ORM) and Redis, deployed via Docker Compose. Covers 41 endpoints across 7 feature modules, JWT RS256 auth, class-validator DTOs with Swagger, and NestJS CacheModule integration.

## Executive Summary

This TechSpec defines the implementation plan for the Lista Fácil backend API — a greenfield NestJS REST API backed by PostgreSQL (via Prisma ORM) and Redis, deployed via Docker Compose for v1. The API serves 41 REST endpoints across 7 feature modules (AuthModule, UsersModule, ProductsModule, PricesModule, StoresModule, ListsModule, PurchasesModule) with a shared CoreModule providing Prisma, Redis, JWT authentication, and global exception handling.

Key architectural decisions:

- **Thin Controller + Direct Prisma Services** — no repository layer; services call PrismaService directly
- **class-validator + class-transformer** — decorator-based DTOs with native NestJS ValidationPipe and full @nestjs/swagger auto-generation
- **Custom error envelope** — `{ statusCode, error, message, details?, timestamp }` consumed by the mobile app
- **NestJS CacheModule** — declarative @CacheKey/@CacheTTL decorators for Redis caching
- **JWT RS256** — 15min access tokens + 30d opaque refresh tokens with rotation
- **No PostGIS/GeoService** — stores persist latitude/longitude as Float columns only; spatial queries deferred
- **No materialized views** — aggregations computed in service layer with Redis cache; deferred to v2

The database schema consists of 12 tables and 4 enums managed entirely through Prisma migrations.

## System Architecture

### Domain Placement

```plaintext
listafacil-api/
├── prisma/
│   ├── schema.prisma              # 12 models, 4 enums
│   └── migrations/                # Prisma migration history
├── src/
│   ├── main.ts                    # Bootstrap, Swagger, global pipes/filters
│   ├── app.module.ts              # Root module importing all feature modules
│   ├── core/                      # CoreModule (Global): shared infrastructure
│   │   ├── core.module.ts
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   └── prisma.service.ts
│   │   ├── redis/
│   │   │   └── redis.module.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── list-access.guard.ts
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── public.decorator.ts
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts
│   │   └── dto/
│   │       ├── pagination-query.dto.ts
│   │       └── paginated-response.dto.ts
│   ├── auth/                      # AuthModule
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── jwt-refresh.strategy.ts
│   │   └── dto/
│   ├── users/                     # UsersModule
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── dto/
│   ├── products/                  # ProductsModule
│   │   ├── products.module.ts
│   │   ├── products.controller.ts
│   │   ├── products.service.ts
│   │   └── dto/
│   ├── prices/                    # PricesModule
│   │   ├── prices.module.ts
│   │   ├── prices.controller.ts
│   │   ├── prices.service.ts
│   │   └── dto/
│   ├── stores/                    # StoresModule
│   │   ├── stores.module.ts
│   │   ├── stores.controller.ts
│   │   ├── stores.service.ts
│   │   └── dto/
│   ├── lists/                     # ListsModule
│   │   ├── lists.module.ts
│   │   ├── lists.controller.ts
│   │   ├── lists.service.ts
│   │   ├── items/
│   │   │   ├── list-items.controller.ts
│   │   │   └── list-items.service.ts
│   │   ├── members/
│   │   │   ├── list-members.controller.ts
│   │   │   └── list-members.service.ts
│   │   ├── invites/
│   │   │   ├── invites.controller.ts
│   │   │   └── invites.service.ts
│   │   └── dto/
│   └── purchases/                 # PurchasesModule
│       ├── purchases.module.ts
│       ├── purchases.controller.ts
│       ├── purchases.service.ts
│       └── dto/
├── test/
│   └── unit/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── nest-cli.json
└── package.json
```

### Module Boundaries

| Module | Responsibility | Dependencies |
| --- | --- | --- |
| CoreModule (global) | PrismaService, CacheModule (Redis), JwtAuthGuard, AllExceptionsFilter, ValidationPipe, pagination DTOs | None (foundation) |
| AuthModule | Register, login, JWT refresh token rotation | CoreModule |
| UsersModule | User profile CRUD, savings summary | CoreModule |
| ProductsModule | Product CRUD, search, barcode lookup | CoreModule |
| PricesModule | Price submission, comparison, history, validation voting | CoreModule |
| StoresModule | Store listing and details (filterable by city/state) | CoreModule |
| ListsModule | Shopping lists, items, members, invites, price optimization | CoreModule, PricesModule |
| PurchasesModule | Purchase lifecycle, cart items, status transitions | CoreModule |

### Component Overview

```plaintext
┌─────────────────────────────────────────────────────────────────┐
│                          AppModule                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  CoreModule (@Global)                                      │  │
│  │  PrismaService │ CacheModule(Redis) │ Guards │ Filters     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────┐ ┌───────────┐ ┌──────────────┐ ┌────────────┐   │
│  │AuthModule│ │UsersModule│ │ProductsModule│ │StoresModule│   │
│  └──────────┘ └───────────┘ └──────────────┘ └────────────┘   │
│  ┌────────────┐ ┌──────────────┐                               │
│  │PricesModule│ │PurchasesModule│                               │
│  └────────────┘ └──────────────┘                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ListsModule (items, members, invites, optimize)           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

- HTTP Request → NestJS middleware (request ID) → ValidationPipe (class-validator) → JwtAuthGuard → Controller
- Controller → Service (business logic) → PrismaService (database) → Response DTO
- Caching: CacheInterceptor on annotated controller methods reads/writes Redis
- Error path: Exception → AllExceptionsFilter → standard error envelope response

## Implementation Design

### Core Interfaces

**PrismaService** (`src/core/prisma/prisma.service.ts`):

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}
```

**AuthService** (`src/auth/auth.service.ts`):

```typescript
@Injectable()
export class AuthService {
  register(dto: RegisterDto): Promise<AuthResponseDto>;
  login(dto: LoginDto): Promise<AuthResponseDto>;
  refreshToken(oldToken: string): Promise<TokenPairDto>;
}
```

**ProductsService** (`src/products/products.service.ts`):

```typescript
@Injectable()
export class ProductsService {
  search(query: SearchProductsQueryDto): Promise<PaginatedResponse<ProductResponseDto>>;
  findById(id: string): Promise<ProductResponseDto>;
  findByBarcode(barcode: string): Promise<ProductResponseDto>;
  create(dto: CreateProductDto): Promise<ProductResponseDto>;
}
```

**PricesService** (`src/prices/prices.service.ts`):

```typescript
@Injectable()
export class PricesService {
  submitPrice(productId: string, dto: SubmitPriceDto, userId: string): Promise<PriceResponseDto>;
  getProductPrices(productId: string, query: PaginationQueryDto): Promise<PaginatedResponse<PriceResponseDto>>;
  getComparison(productId: string): Promise<PriceComparisonDto>;
  getPriceHistory(productId: string, storeId?: string): Promise<PriceHistoryPointDto[]>;
  validatePrice(priceId: string, dto: ValidatePriceDto, userId: string): Promise<void>;
}
```

**ListsService** (`src/lists/lists.service.ts`):

```typescript
@Injectable()
export class ListsService {
  findUserLists(userId: string): Promise<ShoppingListResponseDto[]>;
  findById(id: string, userId: string): Promise<ShoppingListDetailDto>;
  create(dto: CreateListDto, userId: string): Promise<ShoppingListResponseDto>;
  update(id: string, dto: UpdateListDto, userId: string): Promise<ShoppingListResponseDto>;
  delete(id: string, userId: string): Promise<void>;
  optimize(id: string, userId: string): Promise<OptimizationResultDto>;
}
```

### Data Models

**Prisma Schema** (`prisma/schema.prisma`):

```prisma
generator client {
  provider     = "prisma-client-js"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ProductCategory {
  fruits
  vegetables
  dairy
  meat
  bakery
  beverages
  cleaning
  hygiene
  snacks
  grains
  frozen
  other
}

enum StoreType {
  supermarket
  hypermarket
  convenience
  wholesale
}

enum PurchaseStatus {
  active
  completed
  cancelled
}

enum ShareRole {
  editor
  viewer
}

model User {
  id           String   @id @default(uuid())
  name         String   @db.VarChar(200)
  email        String   @unique @db.VarChar(320)
  passwordHash String   @map("password_hash") @db.VarChar(256)
  avatarUrl    String?  @map("avatar_url")
  joinedAt     DateTime @default(now()) @map("joined_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  prices           Price[]
  priceValidations PriceValidation[]
  shoppingLists    ShoppingList[]
  listMembers      ListMember[]
  listInvites      ListInvite[]
  purchases        Purchase[]
  refreshTokens    RefreshToken[]

  @@map("users")
}

model Product {
  id        String          @id @default(uuid())
  name      String          @db.VarChar(300)
  brand     String          @db.VarChar(200)
  barcode   String          @unique @db.VarChar(50)
  category  ProductCategory @default(other)
  unit      String          @db.VarChar(50)
  imageUrl  String?         @map("image_url")
  createdAt DateTime        @default(now()) @map("created_at")
  updatedAt DateTime        @updatedAt @map("updated_at")

  prices        Price[]
  listItems     ListItem[]
  purchaseItems PurchaseItem[]

  @@index([category, name])
  @@map("products")
}

model Store {
  id        String    @id @default(uuid())
  name      String    @db.VarChar(300)
  address   String    @db.VarChar(500)
  city      String    @db.VarChar(200)
  state     String    @db.Char(2)
  latitude  Float
  longitude Float
  type      StoreType @default(supermarket)
  createdAt DateTime  @default(now()) @map("created_at")

  prices    Price[]
  purchases Purchase[]

  @@index([state, city])
  @@map("stores")
}

model Price {
  id          String   @id @default(uuid())
  productId   String   @map("product_id")
  storeId     String   @map("store_id")
  userId      String   @map("user_id")
  price       Decimal  @db.Decimal(8, 2)
  submittedAt DateTime @default(now()) @map("submitted_at")
  isValid     Boolean  @default(true) @map("is_valid")

  product     Product          @relation(fields: [productId], references: [id], onDelete: Cascade)
  store       Store            @relation(fields: [storeId], references: [id], onDelete: Cascade)
  user        User             @relation(fields: [userId], references: [id], onDelete: SetNull)
  validations PriceValidation[]

  @@index([productId, submittedAt(sort: Desc)])
  @@index([productId, storeId, submittedAt(sort: Desc)])
  @@index([userId, submittedAt(sort: Desc)])
  @@map("prices")
}

model PriceValidation {
  id      String   @id @default(uuid())
  priceId String   @map("price_id")
  userId  String   @map("user_id")
  isValid Boolean  @map("is_valid")
  votedAt DateTime @default(now()) @map("voted_at")

  price Price @relation(fields: [priceId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([priceId, userId])
  @@map("price_validations")
}

model ShoppingList {
  id        String   @id @default(uuid())
  name      String   @db.VarChar(200)
  ownerId   String   @map("owner_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  owner           User         @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  items           ListItem[]
  members         ListMember[]
  invites         ListInvite[]
  linkedPurchases Purchase[]

  @@index([ownerId, updatedAt(sort: Desc)])
  @@map("shopping_lists")
}

model ListItem {
  id             String   @id @default(uuid())
  listId         String   @map("list_id")
  productId      String   @map("product_id")
  quantity       Int      @default(1)
  estimatedPrice Decimal  @default(0) @map("estimated_price") @db.Decimal(8, 2)
  checked        Boolean  @default(false)
  createdAt      DateTime @default(now()) @map("created_at")

  list    ShoppingList @relation(fields: [listId], references: [id], onDelete: Cascade)
  product Product      @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([listId, productId])
  @@index([listId])
  @@map("list_items")
}

model ListMember {
  listId   String    @map("list_id")
  userId   String    @map("user_id")
  role     ShareRole @default(viewer)
  joinedAt DateTime  @default(now()) @map("joined_at")

  list ShoppingList @relation(fields: [listId], references: [id], onDelete: Cascade)
  user User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([listId, userId])
  @@index([userId])
  @@map("list_members")
}

model ListInvite {
  id        String    @id @default(uuid())
  listId    String    @map("list_id")
  invitedBy String    @map("invited_by")
  email     String?   @db.VarChar(320)
  role      ShareRole @default(viewer)
  accepted  Boolean   @default(false)
  createdAt DateTime  @default(now()) @map("created_at")
  expiresAt DateTime  @map("expires_at")

  list    ShoppingList @relation(fields: [listId], references: [id], onDelete: Cascade)
  inviter User         @relation(fields: [invitedBy], references: [id], onDelete: Cascade)

  @@index([listId])
  @@map("list_invites")
}

model Purchase {
  id           String         @id @default(uuid())
  userId       String         @map("user_id")
  storeId      String         @map("store_id")
  linkedListId String?        @map("linked_list_id")
  status       PurchaseStatus @default(active)
  createdAt    DateTime       @default(now()) @map("created_at")
  completedAt  DateTime?      @map("completed_at")

  user       User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  store      Store         @relation(fields: [storeId], references: [id], onDelete: SetNull)
  linkedList ShoppingList? @relation(fields: [linkedListId], references: [id], onDelete: SetNull)
  items      PurchaseItem[]

  @@index([userId, createdAt(sort: Desc)])
  @@map("purchases")
}

model PurchaseItem {
  id         String  @id @default(uuid())
  purchaseId String  @map("purchase_id")
  productId  String  @map("product_id")
  barcode    String  @db.VarChar(50)
  price      Decimal @db.Decimal(8, 2)
  quantity   Int     @default(1)
  fromListId String? @map("from_list_id")

  purchase Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  product  Product  @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@index([purchaseId])
  @@map("purchase_items")
}

model RefreshToken {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  token     String    @unique @db.VarChar(512)
  expiresAt DateTime  @map("expires_at")
  createdAt DateTime  @default(now()) @map("created_at")
  revokedAt DateTime? @map("revoked_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}
```

### Validation Rules

Validation rules (class-validator on DTOs):

- **price**: `@Min(0.01) @Max(99999.99)` — enforced on DTOs and via DB check constraint
- **barcode**: `@IsString() @Length(8, 14)` — EAN-13, UPC-A, EAN-8
- **quantity**: `@IsInt() @Min(1)`
- **email**: `@IsEmail() @MaxLength(320)`
- **name**: `@IsString() @MinLength(2) @MaxLength(200)`
- **password**: `@IsString() @MinLength(8)` — hashed with bcrypt (12 rounds)
- **Pagination**: `page @IsInt() @Min(1)`, `limit @IsInt() @Min(1) @Max(50)`, defaults: page=1, limit=20

DB check constraint (added via raw SQL in Prisma migration):

```sql
ALTER TABLE prices ADD CONSTRAINT chk_price_range CHECK (price BETWEEN 0.01 AND 99999.99);
```

## Contract Specifications

### API Contracts

**Standard Error Envelope** (all error responses from AllExceptionsFilter):

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    { "field": "price", "message": "price must not be greater than 99999.99" }
  ],
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

| Status | Meaning | Trigger |
| --- | --- | --- |
| 400 | Validation error | class-validator failures |
| 401 | Unauthorized | Missing/invalid/expired JWT |
| 403 | Forbidden | Insufficient role or access |
| 404 | Not found | Resource does not exist |
| 409 | Conflict | Duplicate entry (email, barcode, list item) |
| 429 | Rate limited | ThrottlerGuard rejection |
| 500 | Internal error | Unhandled exception |

**Standard Paginated Response**:

```json
{
  "data": [],
  "total": 100,
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

#### POST /v1/auth/register — AuthController (`src/auth/auth.controller.ts`)

Request:

```json
{
  "name": "string (2-200 chars, required)",
  "email": "string (valid email, required)",
  "password": "string (min 8 chars, required)"
}
```

Response 201:

```json
{
  "user": { "id": "uuid", "name": "string", "email": "string", "avatarUrl": null, "joinedAt": "ISO8601" },
  "accessToken": "jwt",
  "refreshToken": "opaque"
}
```

Errors: 400 (validation), 409 (email exists)

#### POST /v1/auth/login — AuthController

Request: `{ "email": "string", "password": "string" }`

Response 200: Same shape as register response.

Errors: 400 (validation), 401 (invalid credentials)

#### POST /v1/auth/refresh — AuthController

Request: Bearer refresh token in Authorization header.

Response 200: `{ "accessToken": "new jwt", "refreshToken": "new opaque" }`

Errors: 401 (invalid/expired/revoked token)

Behavior: Rotates refresh token — old token revoked, new pair issued.

#### POST /v1/products/:productId/prices — PricesController (`src/prices/prices.controller.ts`)

Request:

```json
{
  "storeId": "uuid (required)",
  "price": "decimal 0.01-99999.99 (required)"
}
```

Response 201:

```json
{
  "id": "uuid",
  "productId": "uuid",
  "storeId": "uuid",
  "userId": "uuid",
  "price": 4.89,
  "submittedAt": "ISO8601",
  "isValid": true,
  "store": { "id": "uuid", "name": "string" }
}
```

Errors: 400 (validation), 404 (product or store not found)

Side effect: Invalidates Redis cache `prices:comparison:{productId}`.

#### GET /v1/lists/:id/optimize — ListsController (`src/lists/lists.controller.ts`)

Request: Path param `id` (list UUID). Requires list access (owner or member).

Response 200:

```json
{
  "listId": "uuid",
  "itemCount": 10,
  "stores": [
    {
      "storeId": "uuid",
      "storeName": "string",
      "totalCost": 85.43,
      "itemsAvailable": 8,
      "itemsMissing": 2,
      "savings": 12.34
    }
  ],
  "bestStore": {
    "storeId": "uuid",
    "storeName": "string",
    "totalCost": 73.36,
    "savings": 24.41
  }
}
```

Algorithm: For each store, sum the latest valid price per list item product. Rank stores by total cost ascending. Complexity: O(S x I) where S = stores with prices, I = list items.

Errors: 403 (not a member), 404 (list not found)

#### POST /v1/prices/:priceId/validate — PricesController

Request: `{ "isValid": "boolean (required)" }`

Response: 204 No Content

Errors: 400 (validation), 403 (cannot validate own price), 404 (price not found), 409 (already voted)

### Data Contracts

| Table | Key Fields | Constraints |
| --- | --- | --- |
| users | id (PK uuid), name, email, password_hash, avatar_url, joined_at, updated_at | Unique email |
| products | id (PK), name, brand, barcode, category (enum), unit, image_url | Unique barcode |
| stores | id (PK), name, address, city, state, latitude (Float), longitude (Float), type (enum) | Index (state, city) |
| prices | id (PK), product_id (FK), store_id (FK), user_id (FK), price (decimal 8,2), submitted_at, is_valid | CHECK price 0.01-99999.99 |
| price_validations | id (PK), price_id (FK), user_id (FK), is_valid, voted_at | Unique (price_id, user_id) |
| shopping_lists | id (PK), name, owner_id (FK), created_at, updated_at | Index owner_id |
| list_items | id (PK), list_id (FK), product_id (FK), quantity, estimated_price, checked | Unique (list_id, product_id) |
| list_members | list_id + user_id (composite PK), role (enum), joined_at | FK→lists, FK→users |
| list_invites | id (PK), list_id (FK), invited_by (FK), email, role, accepted, expires_at | Index list_id |
| purchases | id (PK), user_id (FK), store_id (FK), linked_list_id (FK nullable), status (enum) | Index user_id |
| purchase_items | id (PK), purchase_id (FK), product_id (FK), barcode, price, quantity | Index purchase_id |
| refresh_tokens | id (PK), user_id (FK), token (unique), expires_at, revoked_at (nullable) | Unique token |

Migration strategy: Prisma initial migration creates all 12 tables + 4 enums. Price check constraint added via raw SQL in migration.

## API Endpoints

### Auth (public — no JWT required)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /v1/auth/register | User registration |
| POST | /v1/auth/login | User login |
| POST | /v1/auth/refresh | Refresh JWT tokens |

### Users (authenticated)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /v1/users/me | Get current user profile with stats |
| PATCH | /v1/users/me | Update user profile |
| GET | /v1/users/me/savings | Get savings summary |

### Products (authenticated)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /v1/products | Search/list products (paginated) |
| GET | /v1/products/:id | Get product by ID |
| GET | /v1/products/barcode/:barcode | Get product by barcode |
| POST | /v1/products | Create new product |

### Prices (authenticated)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /v1/products/:productId/prices | List prices for product (paginated) |
| GET | /v1/products/:productId/prices/comparison | Price comparison across stores |
| GET | /v1/products/:productId/prices/history | Price history (optional storeId filter) |
| POST | /v1/products/:productId/prices | Submit a price |
| POST | /v1/prices/:priceId/validate | Vote on price validity |

### Stores (authenticated)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /v1/stores | List stores (filterable by city/state) |
| GET | /v1/stores/:id | Get store details |

### Shopping Lists (authenticated, access-controlled)

| Method | Path | Purpose | Access |
| --- | --- | --- | --- |
| GET | /v1/lists | Get user's lists | owner + member |
| POST | /v1/lists | Create list | any authenticated |
| GET | /v1/lists/:id | Get list with items | owner + member |
| PATCH | /v1/lists/:id | Update list name | owner + editor |
| DELETE | /v1/lists/:id | Delete list | owner only |
| POST | /v1/lists/:id/items | Add item to list | owner + editor |
| PATCH | /v1/lists/:id/items/:itemId | Update list item | owner + editor |
| DELETE | /v1/lists/:id/items/:itemId | Remove list item | owner + editor |
| GET | /v1/lists/:id/optimize | Optimize list pricing | owner + member |
| GET | /v1/lists/:id/members | List members | owner + member |
| POST | /v1/lists/:id/share/email | Share by email | owner + editor |
| POST | /v1/lists/:id/share/invite | Generate invite link | owner + editor |
| DELETE | /v1/lists/:id/members/:userId | Remove member | owner (or self) |
| GET | /v1/invites/:inviteId | View invite details | public |
| POST | /v1/invites/:inviteId/join | Accept invite | authenticated |

### Purchases (authenticated, owner only)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /v1/purchases | List purchases (paginated) |
| GET | /v1/purchases/recent | Recent completed purchases |
| POST | /v1/purchases | Start new purchase |
| GET | /v1/purchases/:id | Get purchase with items |
| PATCH | /v1/purchases/:id | Update status (complete/cancel) |
| POST | /v1/purchases/:id/items | Add item to purchase |
| PATCH | /v1/purchases/:id/items/:itemId | Update purchase item |
| DELETE | /v1/purchases/:id/items/:itemId | Remove purchase item |

Total: 41 endpoints

## Integration Points

### Redis (via NestJS CacheModule)

- Connection: `REDIS_URL` environment variable → Docker Compose redis:6379
- Packages: `@nestjs/cache-manager` + `cache-manager` + `cache-manager-redis-yet`
- Declarative caching via `@CacheKey()` and `@CacheTTL()` decorators on controller methods
- Cache invalidation: manual `cacheManager.del(key)` in service write methods

| Cache Key Pattern | TTL | Invalidation Trigger |
| --- | --- | --- |
| `product:{id}` | 1h | Product update |
| `products:search:{queryHash}` | 5min | Short TTL, no explicit invalidation |
| `stores:all` | 24h | Store create/update |
| `prices:comparison:{productId}` | 5min | New price submitted |
| `user:{id}:stats` | 15min | Price submission or purchase completion |
| Shopping lists | NOT cached | Collaborative editing requires fresh data |

### Rate Limiting (via @nestjs/throttler)

- Storage: Redis adapter (`@nestjs/throttler/dist/storages/redis`)
- Configured globally in CoreModule, with per-route overrides via `@Throttle()` decorator

| Endpoint Pattern | Limit | Window |
| --- | --- | --- |
| POST /v1/auth/login | 5 | 15 min |
| POST /v1/auth/register | 3 | 1 hour |
| POST /v1/products/:id/prices | 30 | 1 hour |
| POST /v1/prices/:id/validate | 60 | 1 hour |
| POST /v1/products | 10 | 1 hour |
| All other authenticated | 120 | 1 min |

### JWT Authentication (via @nestjs/passport)

- Strategy: RS256 with RSA key pair (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` env vars)
- Access token: 15 min TTL, stateless, signed with private key
- Refresh token: 30 day TTL, cryptographically random opaque string, stored in `refresh_tokens` table
- Token rotation: on refresh, old token revoked, new pair issued

## Sequence and Failure Flows

### Primary Execution Sequence

**User Registration:**

1. Client → POST /v1/auth/register with `{ name, email, password }`
2. ValidationPipe validates RegisterDto (class-validator decorators)
3. AuthService.register():
   - Check email uniqueness: `prisma.user.findUnique({ where: { email } })`
   - Hash password: `bcrypt.hash(password, 12)`
   - Create user: `prisma.user.create({ data })`
   - Generate access token (JWT RS256, 15min) + refresh token (crypto.randomBytes, 30d)
   - Store refresh token: `prisma.refreshToken.create({ data })`
4. Response → 201 with user + tokens

**Price Submission:**

1. Client → POST /v1/products/:productId/prices with Bearer JWT
2. JwtAuthGuard validates token, extracts userId
3. ValidationPipe validates SubmitPriceDto
4. PricesService.submitPrice():
   - Verify product: `prisma.product.findUniqueOrThrow({ where: { id: productId } })`
   - Verify store: `prisma.store.findUniqueOrThrow({ where: { id: dto.storeId } })`
   - Create price: `prisma.price.create({ data: { productId, storeId, userId, price: dto.price } })`
   - Invalidate cache: `cacheManager.del('prices:comparison:' + productId)`
5. Response → 201

**List Optimization:**

1. Client → GET /v1/lists/:id/optimize with Bearer JWT
2. JwtAuthGuard → ListAccessGuard (verifies owner or member)
3. ListsService.optimize():
   - Fetch list items with products: `prisma.listItem.findMany({ where: { listId }, include: { product: true } })`
   - Fetch all stores: `prisma.store.findMany()`
   - For each store, query latest valid price per product via `$queryRaw`:
     ```sql
     SELECT DISTINCT ON (product_id) product_id, price
     FROM prices WHERE store_id = $1 AND product_id = ANY($2) AND is_valid = true
     ORDER BY product_id, submitted_at DESC
     ```
   - Calculate total per store, rank by lowest total
4. Response → 200 with OptimizationResultDto

**Purchase Completion:**

1. Client → PATCH /v1/purchases/:id with `{ "status": "completed" }`
2. PurchasesService.updateStatus():
   - Verify ownership: `purchase.userId === currentUser.id`
   - Update: `prisma.purchase.update({ where: { id }, data: { status: 'completed', completedAt: new Date() } })`
   - Invalidate user stats cache: `cacheManager.del('user:' + userId + ':stats')`
3. Response → 200 with updated purchase

### Failure Behavior

**Validation Failures (400):**

- class-validator decorators fail → ValidationPipe throws BadRequestException
- AllExceptionsFilter formats as error envelope with details array containing field-level errors

**Resource Not Found (404):**

- Prisma `findUniqueOrThrow` throws `PrismaClientKnownRequestError` (code P2025)
- Service catches → throws NotFoundException → filter formats as `{ statusCode: 404, error: "Not Found", message: "..." }`

**Duplicate Entry (409):**

- Prisma unique constraint violation (code P2002) → service catches → throws ConflictException
- Examples: duplicate email, duplicate barcode, duplicate list item

**Authentication Failures (401):**

- Missing/expired/invalid JWT → JwtAuthGuard throws UnauthorizedException
- Invalid refresh token → AuthService throws UnauthorizedException (does NOT reveal expired vs. revoked)

**Authorization Failures (403):**

- ListAccessGuard checks ownership/membership → throws ForbiddenException
- Purchase endpoints verify `purchase.userId === currentUser.id`
- Price validation: user cannot validate own price → ForbiddenException

**Rate Limit (429):**

- ThrottlerGuard rejects → AllExceptionsFilter formats with Retry-After header

**Database Connection Failure:**

- PrismaService.onModuleInit() fails → NestJS exits process; Docker Compose `restart: unless-stopped` handles recovery
- Runtime query failure → Prisma throws → service catches → InternalServerErrorException + error logged

## Impact Analysis

| Affected Component | Type of Impact | Description & Risk Level | Required Action |
| --- | --- | --- | --- |
| Mobile app (listafacil-app) | API Consumer (New) | New backend replaces mock repositories. Mobile Mock*Repository implementations swap for Api*Repository using defined contracts. Medium risk. | Update mobile repositories to call real endpoints |
| Docker Compose infra | New Infrastructure | PostgreSQL 16 + Redis 7 + NestJS API. Low risk (local only for v1). | Create docker-compose.yml and Dockerfile |
| Database schema | New Schema | 12 tables + 4 enums via Prisma migrations. Medium risk (initial schema correctness). | Peer-review Prisma schema before first migration |

## Testing Approach

### Unit Tests

Strategy: In-memory mocks only. Every service and controller tested in isolation using Jest + @nestjs/testing.

**Mock approach:**

- PrismaService: manual mock with `jest.fn()` for each model method (findMany, create, update, delete, findUnique, findUniqueOrThrow)
- CacheManager: mock `get()`, `set()`, `del()` returning `jest.fn()`
- JwtService: mock `sign()` / `verify()` returning test tokens

**Key test scenarios per module:**

| Module | Critical Scenarios |
| --- | --- |
| AuthService | Register valid data, duplicate email (409), login wrong password (401), refresh token rotation, expired refresh token |
| ProductsService | Search with filters, barcode lookup found/not found, create duplicate barcode (409) |
| PricesService | Submit valid price, non-existent product (404), comparison aggregation, validate own price (403) |
| ListsService | Create list, add item, duplicate item (409), optimize across stores, access control (owner/editor/viewer) |
| PurchasesService | Create purchase, add items, complete (status transition), cancel |
| AllExceptionsFilter | Validation error formatting, Prisma error mapping (P2002→409, P2025→404), unknown→500 |

Test location: `src/<module>/<module>.service.spec.ts`, `src/<module>/<module>.controller.spec.ts`

### Integration Tests

Deferred to v2. Unit tests with mocked Prisma provide sufficient coverage for initial development.

### End-to-End / Contract Verification

**Manual via Swagger UI (v1):**

- Swagger at GET /api/docs in development
- All DTOs decorated with `@ApiProperty()` for complete schema documentation
- Test each endpoint against Docker Compose stack before mobile integration

**Automated (v2):** Add supertest-based contract tests or Pact consumer-driven contract tests.

## Development Sequencing

### Build Order

**1. Project scaffolding + CoreModule (Week 1)**

- `nest new`, Prisma schema, Docker Compose, CoreModule (PrismaService, AllExceptionsFilter, ValidationPipe, pagination DTOs)
- Why first: Foundation for all modules

**2. AuthModule (Week 2)**

- JWT RS256 setup, register/login/refresh, JwtAuthGuard, `@Public()` decorator
- Why second: All other modules require authentication

**3. ProductsModule + StoresModule (Week 3)**

- Product CRUD, barcode lookup, store listing (filterable by city/state)
- Why third: Products and stores are referenced by prices, lists, and purchases

**4. PricesModule (Week 4)**

- Price submission, comparison, history, validation voting
- Depends on Products + Stores

**5. ListsModule (Week 5-6)**

- Lists CRUD, items, members, invites, optimization algorithm
- Most complex module; depends on Products + Prices for optimization
- Includes ListAccessGuard for role-based access

**6. PurchasesModule (Week 6)**

- Purchase lifecycle, items, status transitions
- Depends on Products + Stores

**7. Redis caching + rate limiting (Week 7)**

- CacheModule integration, @CacheKey/@CacheTTL decorators, ThrottlerModule
- Applied last: easier to add caching to working endpoints

**8. Swagger + unit tests (Week 7-8)**

- `@ApiProperty` on all DTOs, `@ApiTags`/`@ApiResponse` on controllers
- Unit tests for all services and controllers

### Technical Dependencies

| Dependency | Required By | Status |
| --- | --- | --- |
| Docker + Docker Compose | Local dev environment | Developer machine prerequisite |
| PostgreSQL 16 | PrismaService | Docker Compose service |
| Redis 7 | CacheModule, ThrottlerModule | Docker Compose service |
| RSA key pair | JWT RS256 | Generated via openssl during setup |
| Node.js 20+ | NestJS runtime | Developer machine prerequisite |

### NPM Packages

| Package | Purpose |
| --- | --- |
| @nestjs/core, @nestjs/common, @nestjs/platform-express | NestJS framework |
| @nestjs/config | Environment variable management |
| @nestjs/passport, passport, passport-jwt | JWT authentication |
| @nestjs/jwt | Token signing/verification |
| @nestjs/swagger | OpenAPI auto-generation |
| @nestjs/cache-manager, cache-manager, cache-manager-redis-yet | Redis caching |
| @nestjs/throttler | Rate limiting |
| @nestjs/terminus | Health checks |
| @prisma/client, prisma | Database ORM |
| class-validator, class-transformer | DTO validation |
| bcrypt | Password hashing |

## Monitoring & Observability

v1 approach (Docker Compose — no cloud infrastructure):

### Structured Logging

- NestJS built-in Logger with JSON format
- Log levels: error (exceptions), warn (rate limits, anomalies), log (request lifecycle), debug (query details)
- Request ID middleware: generates UUID per request, attached to all log lines via AsyncLocalStorage
- Aggregated via `docker compose logs -f api`

### Health Checks

- @nestjs/terminus HealthModule at GET /v1/health
- Checks: PostgreSQL (`prisma.$queryRaw('SELECT 1')`), Redis (ping), memory heap
- Docker Compose healthcheck directive for auto-restart

### Key Metrics (logged, not exported for v1)

- Request duration per endpoint (middleware timing)
- Error rates by status code
- Cache hit/miss ratio (logged in CacheInterceptor)

## Operational Acceptance

**v1 readiness criteria:**

- Health endpoint returns 200 with all dependencies healthy
- API responds within 500ms p99 for authenticated requests
- No uncaught exceptions in logs after 24h of usage
- All 41 endpoints return expected status codes per contract

**v2 upgrade path:**

- Replace Docker Compose PostgreSQL → AWS RDS
- Replace Docker Compose Redis → AWS ElastiCache
- Add Prometheus metrics exporter + Grafana dashboards
- Add distributed tracing via OpenTelemetry

## Rollout and Rollback

### Rollout Plan

v1 strategy (Docker Compose):

1. **Development**: All work against local Docker Compose stack. Prisma migrations versioned in `prisma/migrations/`. `.env.example` committed.
2. **Staging validation**: Run Docker Compose on staging machine. Execute manual Swagger-based testing of all 41 endpoints. Verify mobile app integration.
3. **Production deployment**: `docker compose up -d --build`. Prisma migration auto-applied on startup via `prisma migrate deploy`. Verify health endpoint, then route mobile traffic.

No feature flags for v1 — all features ship together. Feature flags deferred to v2.

### Rollback Plan

**Database rollback:**

- Always create PostgreSQL dump before migrations: `pg_dump -U postgres listafacil > backup_$(date +%Y%m%d).sql`
- Schema rollback: `prisma migrate resolve --rolled-back <name>` + apply corrective migration
- Prefer additive schema changes over destructive ones

**Application rollback:**

- Keep previous Docker image tagged: `docker tag listafacil-api:latest listafacil-api:previous`
- Rollback: `docker compose down && docker tag listafacil-api:previous listafacil-api:latest && docker compose up -d`
- If migration was applied, restore from pg_dump

**Data consistency:**

- Write operations use Prisma transactions where atomicity required (e.g., purchase completion)
- No destructive data changes on rollback

## Technical Considerations

### Key Decisions

| Decision | Choice | Rationale | Rejected Alternative |
| --- | --- | --- | --- |
| Architecture | Thin Controller + Direct Prisma Services | Simplest for greenfield; no premature abstraction | Repository pattern (unnecessary layer) |
| Validation | class-validator + class-transformer | Native NestJS, decorator DTOs, Swagger integration | Zod (poor NestJS integration) |
| Error format | `{ statusCode, error, message, details?, timestamp }` | Simple, consistent, mobile-friendly | RFC 7807 (too complex for v1) |
| Deployment | Docker Compose | Fastest dev setup, zero cloud cost | AWS ECS (deferred to v2) |
| Geospatial | Float lat/lng columns, no PostGIS | Simplifies schema; spatial queries not needed for v1 | PostGIS geography (deferred) |
| Materialized views | Not implemented | Prisma lacks native support; Redis cache sufficient for v1 | pg_cron + MVs (deferred to v2) |
| Caching | NestJS CacheModule decorators | Declarative, minimal boilerplate | Manual Redis calls |
| Testing | Unit tests only, mocked Prisma | Fastest velocity for v1 | Testcontainers (deferred to v2) |
| ORM | Prisma (moduleFormat: "cjs") | Type-safe, auto-generated client, migrations | TypeORM (weaker type safety) |
| Auth | JWT RS256 + refresh rotation | Stateless access, secure refresh | Session-based (stateful) |
| API docs | Full Swagger auto-gen | Zero-cost documentation from code | Manual docs |

### Known Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Prisma moduleFormat: "cjs" | Build failures | Low | Set in schema.prisma, test on init |
| Product search without pg_trgm | Poor fuzzy matching | Medium | Prisma contains insensitive for v1; add pg_trgm in v2 |
| No integration tests | Bugs at DB boundary | Medium | Thorough Swagger manual testing; testcontainers in v2 |
| List optimization performance | Slow for many stores | Low (v1 scale) | Raw SQL batching + Redis cache |
| Refresh token table growth | Unbounded revoked tokens | Low | NestJS @Cron cleanup for expired tokens >30d |
| Price aggregation without MVs | Repeated queries on large tables | Low (v1 scale) | Redis cache (5min TTL); add MVs in v2 |

### Assumptions

- Greenfield repository starting from `nest new` — no existing code to preserve.
- Mobile app will swap Mock*Repository for Api*Repository consuming these contracts.
- Docker Compose is the only deployment target for v1; cloud migration is separate.
- RSA key pair generated manually, stored as env vars (no cloud KMS for v1).
- Product catalog created via POST /v1/products — no external barcode API integration.
- Store data seeded manually — no Google Maps integration for v1.
- Price validity: valid if `upvotes/total >= 0.6` OR `total_votes < 3`. Prices >30 days auto-invalidated via scheduled job.

### Open Technical Questions

- Should v1 include pg_trgm + unaccent extensions for fuzzy product search, or is Prisma `contains` sufficient for the initial user base?
- Should v1 include image upload (presigned URLs to S3/local storage) or defer to v2?

### Standards Compliance

- **NestJS conventions**: Standard module/controller/service/DTO patterns
- **Prisma best practices**: `@map` for snake_case DB columns, camelCase TypeScript; moduleFormat: "cjs" for NestJS compatibility
- **REST conventions**: v1 prefix, resource-oriented URLs, standard HTTP methods and status codes
- **Security**: bcrypt (12 rounds), JWT RS256, parameterized queries (Prisma), input validation on all endpoints
- **Error handling**: Global AllExceptionsFilter with consistent error envelope
- **API documentation**: Full Swagger/OpenAPI auto-generated from decorators
- **Docker**: Multi-stage Dockerfile, Docker Compose for dev/staging
