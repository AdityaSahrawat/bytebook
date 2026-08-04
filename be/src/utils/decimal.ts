import Decimal from 'decimal.js';

// Configure Decimal.js precision defaults for crypto/stock orderbook precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export class PrecisionMath {
  /**
   * Add two numbers with fixed decimal precision.
   */
  static add(a: number, b: number): number {
    return new Decimal(a).plus(new Decimal(b)).toNumber();
  }

  /**
   * Subtract two numbers with fixed decimal precision.
   */
  static sub(a: number, b: number): number {
    return new Decimal(a).minus(new Decimal(b)).toNumber();
  }

  /**
   * Multiply two numbers with fixed decimal precision.
   */
  static mul(a: number, b: number): number {
    return new Decimal(a).times(new Decimal(b)).toNumber();
  }

  /**
   * Round to specified decimal places (default 8).
   */
  static round(val: number, decimals: number = 8): number {
    return new Decimal(val).toDecimalPlaces(decimals).toNumber();
  }

  /**
   * Check equality with epsilon rounding.
   */
  static equals(a: number, b: number): boolean {
    return new Decimal(a).equals(new Decimal(b));
  }

  /**
   * Check if a > b.
   */
  static gt(a: number, b: number): boolean {
    return new Decimal(a).greaterThan(new Decimal(b));
  }

  /**
   * Check if a >= b.
   */
  static gte(a: number, b: number): boolean {
    return new Decimal(a).greaterThanOrEqualTo(new Decimal(b));
  }

  /**
   * Check if a < b.
   */
  static lt(a: number, b: number): boolean {
    return new Decimal(a).lessThan(new Decimal(b));
  }

  /**
   * Check if a <= b.
   */
  static lte(a: number, b: number): boolean {
    return new Decimal(a).lessThanOrEqualTo(new Decimal(b));
  }
}
