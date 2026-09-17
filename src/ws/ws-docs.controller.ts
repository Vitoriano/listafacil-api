import { Controller, Get } from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('WebSocket Events')
@Controller('ws-docs')
export class WsDocsController {
  @Get('connection')
  @ApiOperation({
    summary: '[WS] Connection & Authentication',
    description: `
## WebSocket Connection

**URL:** \`ws://<host>/\`

**Authentication:** Send the JWT token as a query param or in the \`auth\` handshake:

\`\`\`js
const socket = io('ws://localhost:3000', {
  auth: { token: 'Bearer <JWT>' },
});
\`\`\`

On successful connection, the server automatically joins the client to:
- \`user:{userId}\` room (personal notifications)
- \`list:{listId}\` rooms for all lists the user owns or is a member of
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Documentation only — this endpoint is not callable',
  })
  connection() {
    return { info: 'This endpoint exists only for documentation purposes.' };
  }

  @Get('client-events')
  @ApiOperation({
    summary: '[WS] Client → Server Events',
    description: `
## Events the client sends to the server

### \`join:list\`
Join a list room to receive real-time updates.

**Payload:**
\`\`\`json
{ "listId": "uuid" }
\`\`\`

---

### \`leave:list\`
Leave a list room and stop receiving updates.

**Payload:**
\`\`\`json
{ "listId": "uuid" }
\`\`\`

---

### \`join:purchase\`
Join a purchase room to receive purchase updates.

**Payload:**
\`\`\`json
{ "purchaseId": "uuid" }
\`\`\`

---

### \`leave:purchase\`
Leave a purchase room.

**Payload:**
\`\`\`json
{ "purchaseId": "uuid" }
\`\`\`
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Documentation only — this endpoint is not callable',
  })
  clientEvents() {
    return { info: 'This endpoint exists only for documentation purposes.' };
  }

  @Get('list-item-events')
  @ApiOperation({
    summary: '[WS] Server → Client: List Item Events',
    description: `
## Events emitted when list items change

> **Room:** \`list:{listId}\` — all members and the owner receive these events.

---

### \`list:item:added\`
Emitted when a new item is added to a list.

**Payload:**
\`\`\`json
{
  "id": "uuid",
  "listId": "uuid",
  "productId": "uuid",
  "quantity": 2,
  "estimatedPrice": "25.90",
  "checked": false,
  "createdAt": "2026-03-30T00:00:00.000Z",
  "product": {
    "id": "uuid",
    "name": "Arroz Tio João 5kg",
    "brand": "Tio João",
    "barcode": "7891234567890",
    "categoryId": 1,
    "subCategoryId": 2,
    "unit": "kg",
    "imageUrl": null,
    "latestPrice": {
      "id": "uuid",
      "price": "25.90",
      "storeId": "uuid",
      "submittedAt": "2026-03-30T00:00:00.000Z",
      "store": { "id": "uuid", "name": "Supermercado X" }
    }
  }
}
\`\`\`

---

### \`list:item:updated\`
Emitted when a list item is updated (quantity, checked, estimatedPrice).

**Payload:** Same structure as \`list:item:added\`.

---

### \`list:item:removed\`
Emitted when a list item is removed.

**Payload:**
\`\`\`json
{
  "listId": "uuid",
  "itemId": "uuid"
}
\`\`\`
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Documentation only — this endpoint is not callable',
  })
  listItemEvents() {
    return { info: 'This endpoint exists only for documentation purposes.' };
  }

  @Get('list-events')
  @ApiOperation({
    summary: '[WS] Server → Client: List Events',
    description: `
## Events emitted when a list changes

> **Room:** \`list:{listId}\`

---

### \`list:updated\`
Emitted when a list's metadata is updated (e.g. name).

**Payload:**
\`\`\`json
{
  "id": "uuid",
  "name": "Compras do mês",
  "ownerId": "uuid",
  "createdAt": "2026-03-30T00:00:00.000Z",
  "updatedAt": "2026-03-30T00:00:00.000Z"
}
\`\`\`

---

### \`list:deleted\`
Emitted when a list is deleted by the owner.

**Payload:**
\`\`\`json
{ "listId": "uuid" }
\`\`\`
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Documentation only — this endpoint is not callable',
  })
  listEvents() {
    return { info: 'This endpoint exists only for documentation purposes.' };
  }

  @Get('member-events')
  @ApiOperation({
    summary: '[WS] Server → Client: Member Events',
    description: `
## Events emitted when list membership changes

---

### \`list:member:joined\`
Emitted to the **list room** when a new member joins.

> **Room:** \`list:{listId}\`

**Payload:**
\`\`\`json
{
  "listId": "uuid",
  "userId": "uuid",
  "role": "editor"
}
\`\`\`

---

### \`list:member:removed\`
Emitted to the **list room** when a member is removed.

> **Room:** \`list:{listId}\`

**Payload:**
\`\`\`json
{
  "listId": "uuid",
  "userId": "uuid"
}
\`\`\`

---

### \`list:invited\`
Emitted to the **user's personal room** when they are invited/added to a list.

> **Room:** \`user:{userId}\`

**Payload:**
\`\`\`json
{ "listId": "uuid" }
\`\`\`

---

### \`list:removed\`
Emitted to the **user's personal room** when they are removed from a list.

> **Room:** \`user:{userId}\`

**Payload:**
\`\`\`json
{ "listId": "uuid" }
\`\`\`
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Documentation only — this endpoint is not callable',
  })
  memberEvents() {
    return { info: 'This endpoint exists only for documentation purposes.' };
  }
}
