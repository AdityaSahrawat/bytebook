# ByteVox | Order Matching Engine & Trading Platform

ByteVox is a production-quality, high-performance **Price-Time Priority Order Matching Engine** and real-time **Trading Dashboard** built with Node.js, Fastify, TypeScript, PostgreSQL, Prisma ORM, Next.js 15, and WebSockets.

---

## ⚡ Key Highlights & Features

- 🎯 **Clean Layered Architecture**: Strict separation of concerns (Presentation, Application, Domain, Persistence). The domain matching engine has zero dependencies on web frameworks or databases.
- ⚡ **Price-Time Priority Engine**: Maintains `Bids` (highest price first) and `Asks` (lowest price first) with FIFO queues for identical price levels.
- 🚀 **Fast $O(1)$ Order Cancellation**: Uses an in-memory `orderIndex: Map<orderId, OrderReference>` pointer lookup for $O(1)$ order removal without linear scanning.
- 🔒 **Single-Writer Serial Mutex**: Solves concurrency race conditions by executing matching operations inside an `AsyncMutex` critical section.
- 🛡️ **Atomic Database Transactions**: State updates (`incomingOrder`, `updatedOrders`, `createdTrades`, `cancelledOrders`) commit atomically in a single Prisma transaction (`$transaction`).
- 🔢 **Arbitrary Decimal Math**: Uses `decimal.js` to prevent IEEE-754 floating point representation bugs (`0.1 + 0.2`).
- ⚡ **Sequence-Numbered WebSocket Stream**: Real-time event envelopes (`ORDERBOOK_UPDATED`, `TRADE_EXECUTED`, `STATS_UPDATED`) tagged with monotonically increasing `sequence` IDs.
- 📊 **Aggregated Order Book & Depth Chart**: High-performance `GET /api/orderbook?depth=20` API powering real-time order books and SVG Market Depth Curves.
- 🧪 **Vitest Unit Test Suite**: 100% passing tests for limit/market matching, price-time priority, partial fills, sweeping multiple levels, and cancellations.
- 📚 **Comprehensive System Documentation**: Dedicated `docs/` folder containing `architecture.md`, `matching-engine.md`, and `scaling.md` trade-off analysis.

---

## 🏛️ System Architecture

```
                 REST API Request / WS Stream
                              │
                  Presentation Layer (Fastify)
                              │
                    Application Layer
         🔒 Async Mutex (Single Writer Critical Section)
                              │
       ┌──────────────────────┴──────────────────────┐
       │         Domain Matching Engine (RAM)         │
       │  - Bids: Map<price> + Price Level Queue     │
       │  - Asks: Map<price> + Price Level Queue     │
       │  - orderIndex: Map<orderId, OrderReference> │
       └──────────────────────┬──────────────────────┘
                              │ MatchingResult DTO
                   Persistence Layer
             Prisma Atomic Transaction ($transaction)
                              │
                   WebSocket Server Broadcast
                  { sequence, type, timestamp, data }
```

---

## 🛠️ Tech Stack

### Backend (`be/`)
- **Runtime**: Node.js & TypeScript
- **Web Framework**: Fastify
- **Database**: PostgreSQL & Prisma ORM
- **In-Memory Concurrency**: `async-mutex`
- **Arithmetic Precision**: `decimal.js`
- **Real-Time Feed**: Native WebSocket (`ws`)
- **Test Framework**: Vitest

### Frontend (`fe/`)
- **Framework**: Next.js 15 (App Router) & React 19
- **Styling**: TailwindCSS & Lucide Icons
- **State Management**: TanStack React Query (`@tanstack/react-query`)
- **Real-Time Client**: Native WebSockets with auto-reconnection and sequence tracking

---

## 📡 REST API Documentation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/orders` | Submit a LIMIT or MARKET order |
| `GET` | `/api/orderbook?depth=20` | Fetch aggregated Bids & Asks order book snapshot |
| `GET` | `/api/trades?limit=50` | Fetch executed trades history (newest first) |
| `GET` | `/api/stats` | Fetch market metrics (open bids, open asks, executed trades, total volume) |
| `GET` | `/api/orders/open` | Fetch active resting market orders |
| `DELETE`| `/api/orders/:id` | Cancel an active open order in $O(1)$ time |

---

## ⚡ WebSocket Event Envelope

All real-time WebSocket messages broadcasted on `ws://localhost:3001/ws` follow a standardized sequence envelope:

```json
{
  "sequence": 142,
  "type": "ORDERBOOK_UPDATED",
  "timestamp": "2026-08-04T11:50:00.000Z",
  "data": {
    "bids": [{ "price": 100.0, "totalVolume": 25.0, "orderCount": 3 }],
    "asks": [{ "price": 101.0, "totalVolume": 8.0, "orderCount": 1 }]
  }
}
```

---

## 🚀 Quickstart Guide

### Option 1: One-Command Setup via Docker Compose

```bash
# Launch PostgreSQL, Backend, and Frontend containers
docker-compose up --build
```

- **Frontend Dashboard**: `http://localhost:3000`
- **Backend API**: `http://localhost:3001`
- **WebSocket Stream**: `ws://localhost:3001/ws`

---

### Option 2: Local Development Setup

#### 1. Backend Setup
```bash
cd be

# Install dependencies
npm install

# Start PostgreSQL database (or set DATABASE_URL in .env)
# Push Prisma database schema
npx prisma db push

# Run Vitest unit test suite
npm test

# Start development server
npm run dev
```

#### 2. Frontend Setup
```bash
cd fe

# Install dependencies
npm install

# Start Next.js development dashboard
npm run dev
```

---

## 📚 Deep Dive Documentation (`docs/`)

Explore the technical design documentation in the `docs/` folder:

1. 🏛️ **[docs/architecture.md](docs/architecture.md)** — Layered separation of concerns, request lifecycle, and Prisma transaction boundaries.
2. ⚡ **[docs/matching-engine.md](docs/matching-engine.md)** — Price-Time priority rules, $O(1)$ order index, Limit vs Market orders, and precision arithmetic.
3. 🚀 **[docs/scaling.md](docs/scaling.md)** — Interview Q&A trade-off analysis (Heap vs Map, Mutex vs Row Lock) and horizontal scaling strategy (symbol sharding, Redis Pub/Sub, Kafka streaming).
