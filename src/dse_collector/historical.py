import httpx
from bs4 import BeautifulSoup
from datetime import datetime
from decimal import Decimal, InvalidOperation

def _clean(text: str) -> str:
    return text.replace("\xa0", " ").strip()

def _number(value: str) -> float | None:
    value = _clean(value).replace(",", "")
    if value in {"", "-", "--", "N/A", "n/a"}:
        return None
    try:
        val = float(value)
        return val if val > 0 else None
    except ValueError:
        return None

def fetch_historical_data(symbol: str, start_date: str, end_date: str) -> list[dict]:
    url = f"https://www.dsebd.org/day_end_archive.php?startDate={start_date}&endDate={end_date}&inst={symbol}&archive=data"
    
    with httpx.Client(timeout=30, verify=False) as client:
        r = client.get(url)
        r.raise_for_status()
        
    soup = BeautifulSoup(r.text, 'html.parser')
    tables = soup.find_all('table')
    
    records = []
    
    for table in tables:
        text = table.get_text(strip=True).upper()
        if 'DATE' in text and 'LTP' in text and symbol.upper() in text:
            rows = table.find_all('tr')
            if len(rows) <= 1:
                continue
                
            headers = [th.get_text(strip=True).upper() for th in rows[0].find_all(['th', 'td'])]
            
            for row in rows[1:]:
                cells = [td.get_text(strip=True) for td in row.find_all(['td', 'th'])]
                if len(cells) < len(headers) or cells[0] == 'No Day End Data':
                    continue
                
                # Map based on headers
                row_data = dict(zip(headers, cells))
                
                # Parse
                try:
                    date_str = row_data.get('DATE')
                    trade_date = datetime.strptime(date_str, "%Y-%m-%d").date().isoformat()
                    
                    record = {
                        "trade_code": symbol.upper(),
                        "trade_date": trade_date,
                        "open": _number(row_data.get('OPENP*')),
                        "high": _number(row_data.get('HIGH')),
                        "low": _number(row_data.get('LOW')),
                        "close": _number(row_data.get('CLOSEP*')),
                        "volume": int(_number(row_data.get('VOLUME')) or 0),
                        "value_mn": _number(row_data.get('VALUE (MN)')),
                        "source": "dse_archive_day_end"
                    }
                    records.append(record)
                except Exception as e:
                    print(f"Error parsing row {cells}: {e}")
            break
            
    return records
