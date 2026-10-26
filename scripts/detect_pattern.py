import pandas as pd, json, os, glob

def analyze_ticker(csv_path):
    df = pd.read_csv(csv_path, parse_dates=['trade_date'])
    df = df.sort_values('trade_date').reset_index(drop=True)
    results = []
    for i in range(1, len(df)):
        prev_close = df.at[i-1, 'close']
        curr_close = df.at[i, 'close']
        # detect drop of at least 1% compared to previous close
        if curr_close <= prev_close * 0.99:
            drop_price = curr_close
            drop_date = df.at[i, 'trade_date'].date().isoformat()
            # look ahead up to 10 days (including current day as day 0?)
            for j in range(i, min(i+10, len(df))):
                future_close = df.at[j, 'close']
                if future_close >= drop_price * 1.03:
                    hit_date = df.at[j, 'trade_date'].date().isoformat()
                    days = (df.at[j, 'trade_date'] - df.at[i, 'trade_date']).days
                    results.append({
                        'drop_date': drop_date,
                        'hit_date': hit_date,
                        'days': days
                    })
                    break
    return results

def main():
    folder = r"E:\dse_market_data_collector_FIXED\DSE_2Years_OHLCV_Data\by_symbol"
    tickers = ['SQUARETEXT', 'PTL', 'ENVOYTEX', 'MATINSPINN', 'APEXSPINN']
    summary = {}
    for ticker in tickers:
        csv_path = os.path.join(folder, f"{ticker}.csv")
        if not os.path.exists(csv_path):
            summary[ticker] = {'error': 'CSV not found'}
            continue
        occ = analyze_ticker(csv_path)
        count = len(occ)
        avg_days = round(sum(o['days'] for o in occ)/count, 2) if count else None
        summary[ticker] = {
            'occurrences': count,
            'average_days': avg_days,
            'details': occ
        }
    print(json.dumps(summary, indent=2))

if __name__ == "__main__":
    main()
