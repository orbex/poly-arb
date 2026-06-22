from engine import NegRiskEvent, Market, OrderBook, OrderBookEntry
from strategies import NegRiskArbStrategy

def run_sample_backtest():
    # 1. Setup Mock Event
    # Let's say we have 3 outcomes: A, B, C
    # True probabilities should sum to 1.0
    
    # Outcome A
    book_a = OrderBook(
        bids=[OrderBookEntry(0.29, 100), OrderBookEntry(0.28, 500)],
        asks=[OrderBookEntry(0.31, 100), OrderBookEntry(0.32, 500)]
    )
    market_a = Market(asset_id="A", outcome="A", order_book=book_a)

    # Outcome B
    book_b = OrderBook(
        bids=[OrderBookEntry(0.39, 150), OrderBookEntry(0.38, 500)],
        asks=[OrderBookEntry(0.41, 150), OrderBookEntry(0.42, 500)]
    )
    market_b = Market(asset_id="B", outcome="B", order_book=book_b)

    # Outcome C
    book_c = OrderBook(
        bids=[OrderBookEntry(0.23, 200), OrderBookEntry(0.22, 500)],
        asks=[OrderBookEntry(0.25, 200), OrderBookEntry(0.26, 500)]
    )
    market_c = Market(asset_id="C", outcome="C", order_book=book_c)

    event = NegRiskEvent(event_id="election-2024", markets=[market_a, market_b, market_c])

    # 2. Run Strategy
    strategy = NegRiskArbStrategy(taker_fee=0.0015)
    
    print("--- Underpriced Basket Check ---")
    result_under = strategy.check_underpriced_basket(event)
    print(f"Initial Check: {result_under}")

    if result_under["opportunity"]:
        # Try small size (no slippage)
        print("\nSimulating trade for size 50 (Small):")
        trade_small = strategy.simulate_basket_trade(event, 50, "buy")
        print(f"Expected PnL: {trade_small['expected_pnl']:.4f}")
        print(f"Avg Basket Price: {trade_small['avg_basket_price']:.4f}")

        # Try large size (triggers slippage)
        print("\nSimulating trade for size 500 (Large - Slippage):")
        trade_large = strategy.simulate_basket_trade(event, 500, "buy")
        print(f"Expected PnL: {trade_large['expected_pnl']:.4f}")
        print(f"Avg Basket Price: {trade_large['avg_basket_price']:.4f}")
        for outcome, detail in trade_large['market_details'].items():
            print(f"  {outcome}: Avg Fill Price {detail['avg_price']:.4f}, Slippage {detail['slippage']:.4f}")

    print("\nChecking for Overpriced Basket...")
    # Modify bids to create an overpriced opportunity
    # sum(Bids) > 1.0 + Fees (e.g., 1.0015)
    # Current sum(Bids) = 0.29 + 0.39 + 0.23 = 0.91
    # Let's increase Bid B to 0.5
    market_b.order_book.bids[0].price = 0.5
    # sum(Bids) = 0.29 + 0.5 + 0.23 = 1.02. 1.02 > 1.0015 -> Opportunity!
    
    result_over = strategy.check_overpriced_basket(event)
    print(f"Result: {result_over}")

    if result_over["opportunity"]:
        print("\nSimulating trade for size 50 (Small):")
        trade_small = strategy.simulate_basket_trade(event, 50, "sell")
        print(f"Expected PnL: {trade_small['expected_pnl']:.4f}")
        print(f"Avg Basket Price: {trade_small['avg_basket_price']:.4f}")

        print("\nSimulating trade for size 500 (Large - Slippage):")
        trade_large = strategy.simulate_basket_trade(event, 500, "sell")
        print(f"Expected PnL: {trade_large['expected_pnl']:.4f}")
        print(f"Avg Basket Price: {trade_large['avg_basket_price']:.4f}")
        for outcome, detail in trade_large['market_details'].items():
            print(f"  {outcome}: Avg Fill Price {detail['avg_price']:.4f}, Slippage {detail['slippage']:.4f}")

if __name__ == "__main__":
    run_sample_backtest()
