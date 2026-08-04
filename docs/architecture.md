# ByteVox System Architecture

This document describes the high-level architecture, design patterns, and request execution lifecycle of the **ByteVox Matching Engine and Trading Platform**.

---

## 🏛️ Layered Architecture

ByteVox follows strict clean layered architecture:

```
[ Frontend: Next.js + React Query + WebSockets ]
                         ↓ HTTP / WS
[ Presentation Layer: Fastify Controllers & WS Server ]
                         ↓ DTOs / Requests
[ Application Layer: Order Service + Async Mutex ]
                         ↓ Domain Models
[ Domain Layer: Pure In-Memory Matching Engine & OrderBook ]
                         ↓ Persistence DTOs
[ Persistence Layer: Prisma Repositories + PostgreSQL Database ]
```

### Layer Responsibilities

1. **Presentation Layer (`be/src/controllers/`, `be/src/websocket/`, `be/src/routes/`)**
   - Handles Fastify HTTP routing, query parsing (`?depth=20`), and JSON input validation.
   - Manages WebSocket client connections (`ws`) and broadcasts real-time events wrapped in sequence-numbered envelopes.

2. **Application Layer (`be/src/services/order.service.ts`)**
   - Orchestrates request lifecycle.
   - Enforces single-writer serial matching using an `AsyncMutex` critical section to guarantee price-time priority without race conditions.
   - Coordinates database transactions and triggers WebSocket broadcasts.

3. **Domain Layer (`be/src/engine/`)**
   - **Zero external dependencies** (no Fastify, no Prisma, no HTTP, no async logic).
   - `OrderBook`: In-memory data structure maintaining Bids (Map + Sorted Descending Array) and Asks (Map + Sorted Ascending Array), with an `orderIndex` map for $O(1)$ order cancellation.
   - `MatchingEngine`: Pure synchronous domain engine implementing Price-Time Priority for Limit and Market orders.

4. **Persistence Layer (`be/src/repositories/`, `be/src/db/`)**
   - Mapped via Prisma ORM to PostgreSQL.
   - `OrderRepository`: Executes `prisma.$transaction` to atomically persist incoming orders, resting order quantity modifications, trade records, and cancellation statuses.

---

## 🔄 Request Lifecycle & Transaction Boundaries

```
                 REST API Request
                        │
             Order Controller (Validation)
                        │
               Order Service (Application)
                        │
         🔒 Async Mutex (Single Writer Critical Section)
                        │
      ┌─────────────────┴─────────────────┐
      │     In-Memory Matching Engine      │
      │   - Bids: Map<price> + Sorted DESC│
      │   - Asks: Map<price> + Sorted ASC │
      │   - orderIndex: Map<orderId, Ref> │
      └─────────────────┬─────────────────┘
                        │ Mutates state & returns
                 MatchingResult DTO
       { incomingOrder, updatedOrders, createdTrades, cancelledOrders }
                        │
            DB Persistence Layer
         Prisma Atomic Transaction ($transaction)
                        │
            WebSocket Server Broadcast
        { sequence, type, timestamp, data }
                        │
            Release Mutex Lock 🔓
```

### Atomic Database Guarantee
All state changes produced by the matching engine (`incomingOrder`, `updatedOrders`, `createdTrades`, `cancelledOrders`) are committed in a **single Prisma transaction** (`$transaction`). If the database write fails for any reason, the transaction rolls back cleanly and throws an error to the controller.
