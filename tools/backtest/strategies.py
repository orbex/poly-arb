from typing import Dict, List
from engine import NegRiskEvent, OrderBookEntry

class NegRiskArbStrategy:
    def __init__(self, taker_fee: float = 0.0015):
        self.taker_fee = taker_fee

    def check_underpriced_basket(self, event: NegRiskEvent) -> Dict:
        """
        Check if sum(Asks) < 1.0 - Fees
        """
        total_ask = 0.0
        can_arb = True
        missing_data = []

        for market in event.markets:
            ask = market.order_book.best_ask()
            if ask is None:
                can_arb = False
                missing_data.append(market.outcome)
            else:
                total_ask += ask

        threshold = 1.0 - self.taker_fee
        opportunity = total_ask < threshold if can_arb else False

        return {
            "opportunity": opportunity,
            "total_ask": total_ask,
            "threshold": threshold,
            "missing_data": missing_data
        }

    def check_overpriced_basket(self, event: NegRiskEvent) -> Dict:
        """
        Check if sum(Bids) > 1.0 + Fees
        """
        total_bid = 0.0
        can_arb = True
        missing_data = []

        for market in event.markets:
            bid = market.order_book.best_bid()
            if bid is None:
                can_arb = False
                missing_data.append(market.outcome)
            else:
                total_bid += bid

        threshold = 1.0 + self.taker_fee
        opportunity = total_bid > threshold if can_arb else False

        return {
            "opportunity": opportunity,
            "total_bid": total_bid,
            "threshold": threshold,
            "missing_data": missing_data
        }

    def simulate_basket_trade(self, event: NegRiskEvent, size: float, side: str) -> Dict:
        """
        Simulate buying or selling the entire basket with a given size.
        Accounts for slippage by walking the order book.
        """
        total_value = 0.0
        total_filled = 0.0
        market_details = {}

        for market in event.markets:
            fill_result = market.order_book.simulate_fill(size, "buy" if side == "buy" else "sell")
            total_value += fill_result["total_value"]
            total_filled += fill_result["filled"]
            market_details[market.outcome] = fill_result

        # For buying the basket, total_value is the cost.
        # For selling the basket, total_value is the revenue.
        
        avg_basket_price = total_value / size if size > 0 else 0.0
        
        # Fees
        fee_cost = total_value * self.taker_fee
        
        if side == "buy":
            # PnL = Guarantee(1.0 per unit) - Cost - Fees
            expected_pnl = (size * 1.0) - total_value - fee_cost
        else:
            # PnL = Revenue - Cost(1.0 per unit split) - Fees
            expected_pnl = total_value - (size * 1.0) - fee_cost

        return {
            "side": side,
            "size": size,
            "total_value": total_value,
            "fee_cost": fee_cost,
            "expected_pnl": expected_pnl,
            "avg_basket_price": avg_basket_price,
            "market_details": market_details
        }
