# ByteVox Trade-offs & Scaling Strategy

This document covers key design trade-offs, architecture decisions, and the roadmap for scaling ByteVox to handle millions of transactions per second across multiple asset pairs.

---

## 💡 Architecture Decisions & Trade-offs (Interview Q&A)

### Q1: Why Map + Sorted Array over Binary Heap?
- **Trade-off**: A Binary Heap gives $O(\log N)$ push/pop, but middle element cancellation requires $O(N)$ scanning unless complex intrusive pointers are implemented.
- **Decision**: `Map<price, PriceLevel>` + sorted price array combined with `orderIndex` (`Map<orderId, OrderReference>`) allows $O(1)$ price level lookups and **$O(1)$ order cancellations**. It is cleaner to debug, serialize, and maintain.

### Q2: Why In-Memory Single-Writer Mutex instead of DB Row Locking?
- **Trade-off**: DB row locking (`SELECT FOR UPDATE`) causes database contention, high lock wait times, and deadlock risks under high concurrency.
- **Decision**: Keeping an in-memory runtime order book serialized by an `AsyncMutex` ensures strict price-time priority without race conditions. Sub-millisecond matching performance is achieved by executing matches in RAM and writing DB updates in single atomic transactions.

### Q3: Why PostgreSQL with Prisma ORM?
- **Trade-off**: NoSQL databases (e.g. MongoDB) offer easy sharding, but lack strong relational constraints for trade execution auditing.
- **Decision**: PostgreSQL provides ACID compliant transactions (`$transaction`), ensuring that order status updates and trade records commit atomically or roll back completely.

### Q4: Why Aggregated Order Book API (`?depth=20`)?
- **Trade-off**: Returning all raw orders over HTTP payloads wastes bandwidth and forces the frontend to compute price-level totals.
- **Decision**: Returning aggregated price levels (`bids` & `asks` with `totalVolume` and `orderCount`) mirrors real-world exchange APIs (Binance, Coinbase), enabling instant rendering for Order Books and SVG Depth Charts.

### Q5: Why `decimal.js` for arithmetic?
- **Trade-off**: Native JS floats suffer from floating-point representation bugs (`0.1 + 0.2`).
- **Decision**: `decimal.js` enforces exact arbitrary-precision arithmetic, ensuring zero financial discrepancies in trade execution quantities or resting volumes.

---

## 🚀 Horizontal Scaling Roadmap

To scale ByteVox beyond a single instance to millions of active orders, the architecture can evolve as follows:

```
                      [ Load Balancer / Gateway ]
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
  [ Engine Worker: BTC/USDT ] [ Engine Worker: ETH/USDT ] [ Engine Worker: SOL/USDT ]
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  ▼
                        [ Redis Pub/Sub Cluster ]
                                  │
                       [ WebSocket Gateway Nodes ]
                                  │
                    [ Kafka Queue -> PostgreSQL DB ]
```

1. **Partitioning by Asset Pair (Symbol Sharding)**:
   - Order books for different pairs (`BTC/USDT`, `ETH/USDT`) are completely independent.
   - Deploy dedicated matching engine worker nodes per symbol pair.

2. **Redis Pub/Sub & Caching**:
   - Engine workers publish `ORDERBOOK_UPDATED` and `TRADE_EXECUTED` events to Redis Pub/Sub channels.
   - Stateless WebSocket server instances subscribe to Redis channels and stream updates to connected clients without memory coupling to the engine.

3. **Asynchronous Persistence with Event Sourcing (Kafka / Ring Buffer)**:
   - Decouple matching from database persistence. The engine emits execution events to an append-only log (Apache Kafka or LMAX Disruptor Ring Buffer).
   - Async DB workers read from Kafka and persist trades to PostgreSQL in bulk batches, removing database I/O latency from the core matching loop.
