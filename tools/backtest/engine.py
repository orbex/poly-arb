from dataclasses import dataclass, field
from typing import List, Dict, Optional

@dataclass
class OrderBookEntry:
    price: float
    size: float

@dataclass
class OrderBook:
    bids: List[OrderBookEntry] = field(default_factory=list)
    asks: List[OrderBookEntry] = field(default_factory=list)

    def best_bid(self) -> Optional[float]:
        return self.bids[0].price if self.bids else None

    def best_ask(self) -> Optional[float]:
        return self.asks[0].price if self.asks else None

    def simulate_fill(self, size: float, side: str) -> Dict:
        """
        Simulate filling an order of a given size.
        Returns average price and total cost/revenue.
        """
        remaining = size
        total_value = 0.0
        levels = self.asks if side == "buy" else self.bids

        for entry in levels:
            fill = min(remaining, entry.size)
            total_value += fill * entry.price
            remaining -= fill
            if remaining <= 0:
                break
        
        filled = size - remaining
        avg_price = total_value / filled if filled > 0 else 0.0
        
        return {
            "filled": filled,
            "avg_price": avg_price,
            "total_value": total_value,
            "slippage": (avg_price / levels[0].price - 1) if filled > 0 and levels else 0.0
        }

@dataclass
class Market:
    asset_id: str
    outcome: str
    order_book: OrderBook = field(default_factory=OrderBook)

@dataclass
class NegRiskEvent:
    event_id: str
    markets: List[Market] = field(default_factory=list)

    def get_market_by_outcome(self, outcome: str) -> Optional[Market]:
        for market in self.markets:
            if market.outcome == outcome:
                return market
        return None
