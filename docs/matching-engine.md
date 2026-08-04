# ByteVox Matching Engine Specification

This document provides a deep technical breakdown of the **ByteVox Matching Engine** data structures, price-time priority execution, and trade execution rules.

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

### Complexity Rationale
- **Price Level Lookup**: $O(1)$ via Hash Map.
- **Top Price Level Peek**: $O(1)$ from sorted price array head.
- **Order Cancellation**: **$O(1)$** lookup via `orderIndex` map without linear scanning.
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
