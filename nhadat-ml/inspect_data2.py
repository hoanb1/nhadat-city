import json
import datetime
from decimal import Decimal
from pg_source import load_listings


class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, (datetime.datetime, datetime.date)):
            return o.isoformat()
        if isinstance(o, Decimal):
            return float(o)
        return json.JSONEncoder.default(self, o)


doc = next(load_listings({'status': 2}, limit=1, order_by=None), None)
if doc is None:
    raise SystemExit("No listing with status=2")
print(json.dumps({k: doc[k] for k in doc if k not in ['dynamicFields', 'images', 'contact']}, cls=JSONEncoder, indent=2, ensure_ascii=False))

print("Keys in dynamicFields:")
for df in doc.get('dynamicFields') or []:
    print(f"  {df.get('_id')}: {df.get('value')}")
