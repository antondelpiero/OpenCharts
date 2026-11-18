/**
 * Terminal symbol → exchange trading pair.
 *
 * The terminal names instruments in USD (`BTCUSD`); Binance and the trading
 * backend name the same markets by their USDT pair (`BTCUSDT`). Every call to
 * either goes through this mapper so the translation lives in one place.
 */
const EXCHANGE_PAIRS: Record<string, string> = {
  BTCUSD: "BTCUSDT",
  ETHUSD: "ETHUSDT",
  SOLUSD: "SOLUSDT",
  BNBUSD: "BNBUSDT",
  XRPUSD: "XRPUSDT",
  ADAUSD: "ADAUSDT",
};

export function toExchangePair(symbol: string): string {
  const pair = EXCHANGE_PAIRS[symbol];
  if (!pair) throw new Error(`No exchange pair mapped for symbol "${symbol}"`);
  return pair;
}
