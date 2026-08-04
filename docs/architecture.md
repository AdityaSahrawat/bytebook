# ByteVox System Architecture

This document describes the high-level architecture, design patterns, request execution lifecycle, consistency model, and API contracts of the **ByteVox Matching Engine and Trading Platform**.

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

---

## 🔄 Request Lifecycle & Consistency Model

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
                        │ Mutates RAM state & returns
                 MatchingResult DTO
       { incomingOrder, updatedOrders, createdTrades, cancelledOrders }
                        │
            DB Persistence Layer
         Prisma Atomic Transaction ($transaction)
                        │
             [DB Transaction Success?]
            /                       \
         (Yes)                      (No)
          /                           \
  Increment Sequence              Log Critical Error
         &                         & Trigger Restart /
  WebSocket Broadcast             Rehydrate from PostgreSQL
         │
  Release Mutex 🔓
```

### Consistency Model & Failure Recovery
- **Runtime Source of Truth**: The in-memory Order Book is the primary runtime source for matching performance.
- **Persistence Boundary**: State changes (`incomingOrder`, `updatedOrders`, `createdTrades`, `cancelledOrders`) are committed atomically in PostgreSQL via `prisma.$transaction`.
- **Failure Recovery Guarantee**: If a database transaction fails (e.g. database disconnect), the service logs a critical error and triggers process re-hydration from PostgreSQL (`status IN ('OPEN', 'PARTIALLY_FILLED')`), restoring 100% deterministic consistency between memory and storage.
- **Sequence Guarantee**: Monotonic `sequence` IDs are incremented **only after** the Prisma transaction commits successfully, ensuring WebSocket clients never see phantom sequence gaps due to aborted transactions.

---

## 📡 API Contracts & Response Shapes

### 1. REST API Response Shape
All HTTP endpoints return standardized JSON envelopes:
```json
{
  "success": true,
  "data": {
    "bids": [{ "price": 100.0, "totalVolume": 25.0, "orderCount": 3 }],
    "asks": [{ "price": 101.0, "totalVolume": 8.0, "orderCount": 1 }]
  }
}
```

### 2. WebSocket Real-Time Event Envelope
All WebSocket broadcasts on `ws://localhost:3001/ws` use monotonically increasing `sequence` IDs:
```json
{
  "sequence": 128,
  "type": "ORDERBOOK_UPDATED",
  "timestamp": "2026-08-04T12:26:00.000Z",
  "data": { ... }
}
```


# ByteVox Matching Engine Specification

This document provides a deep technical breakdown of the **ByteVox Matching Engine** data structures, price-time priority execution, trade execution rules, and trade-offs.

---

## ⚡ Price-Time Priority Algorithm

The ByteVox matching engine enforces strict **Price-Time Priority**:

1. **Price Priority**:
   - **BUY Side (Bids)**: Orders with higher limit prices are matched before lower limit prices.
   - **SELL Side (Asks)**: Orders with lower limit prices are matched before higher limit prices.

2. **Time Priority (FIFO)**:
   - Orders at the exact same price level are placed in a **FIFO Queue** (First-In, First-Out).
   - Earliest arriving order (`createdAt` timestamp) is matched first.

---

## ❓ Why Not Use SQL For Matching?

> Although matching could theoretically be implemented with SQL queries and `ORDER BY` clauses, repeatedly scanning and updating the database would introduce massive latency and locking contention. Instead, ByteVox maintains an in-memory runtime order book optimized for matching while PostgreSQL provides durable persistence, recovery, and auditability.

---

## 📦 In-Memory Data Structures

Rather than iterating over all orders in an $O(N)$ database query, ByteVox uses a dedicated in-memory Order Book structure:

```typescript
export interface PriceLevel {
  price: number;
  totalVolume: number;
  orderCount: number;
  orderQueue: Order[]; // FIFO Queue
}

export interface OrderReference {
  order: Order;
  priceLevel: PriceLevel;
  side: Side;
}
```

### Data Structure Components
- **`bids`**: `Map<number, PriceLevel>` + Array of prices sorted **Descending**.
- **`asks`**: `Map<number, PriceLevel>` + Array of prices sorted **Ascending**.
- **`orderIndex`**: `Map<string, OrderReference>` mapping `orderId` directly to its containing `PriceLevel` and `Order` reference.

### Algorithmic Complexity Rationale
- **Price Level Lookup**: $O(1)$ via Hash Map.
- **Top Price Level Peek**: $O(1)$ from sorted price array head.
- **Order Lookup**: **$O(1)$** via `orderIndex` (`Map<string, OrderReference>`).
- **Order Queue Removal**: $O(k)$ where $k$ is the number of orders resting at that specific price level (since $k \ll N$, this is practically instantaneous). *Note: True $O(1)$ queue removal requires a doubly linked list + `Map<OrderId, LinkedListNode>`, which would add pointer complexity.*
- **Sorted Price Array Insertion**: Maintaining sorted price levels has $O(P)$ insertion due to array shifting (where $P$ is the number of active price levels), which simplifies cancellation and debuggability compared to a binary heap.
- **Aggregated Order Book API**: $O(L)$ where $L$ is requested depth ($20$ levels default).

---

## 📊 Order Types & Execution Logic

### 1. LIMIT Orders
- **BUY LIMIT**: Matched against best Ask price level while `bestAsk.price <= buy.price`. Rest placed on Bids book if remaining quantity $> 0$.
- **SELL LIMIT**: Matched against best Bid price level while `bestBid.price >= sell.price`. Rest placed on Asks book if remaining quantity $> 0$.
- **Maker Price Rule**: All executed trades match at the **resting order price** (maker price).

### 2. MARKET Orders
- Market orders **never enter the order book**.
- **BUY MARKET**: Consumes cheapest resting Asks up to available liquidity.
- **SELL MARKET**: Consumes highest resting Bids up to available liquidity.
- If order book liquidity finishes before market order is satisfied, the remaining quantity is marked `CANCELLED` and not placed on the book.

---

## 🔢 Precision Arithmetic

Financial calculations avoid standard JavaScript IEEE-754 floating-point inaccuracies (e.g. `0.1 + 0.2 = 0.30000000000000004`). All engine operations use `decimal.js` via `PrecisionMath` wrapper:
- Price rounding: 8 decimal places.
- Quantity subtraction: `Decimal.minus()`.
