from pg_source import load_listings, connect

# Sample sale listings
print("--- SALE LISTINGS ---")
sale = next(load_listings({'listingMode': 'ban'}, limit=1, order_by=None), None)
if sale:
    print(list(sale.keys()))
    print({k: sale[k] for k in sale if k not in ['dynamicFields', 'images', 'contact']})

# Sample rent listings
print("\n--- RENT LISTINGS ---")
rent = next(load_listings({'listingMode': 'cho_thue'}, limit=1, order_by=None), None)
if rent:
    print(list(rent.keys()))
    print({k: rent[k] for k in rent if k not in ['dynamicFields', 'images', 'contact']})

with connect() as conn:
    cur = conn.cursor()
    # listing_mode NULL == default 'ban' (Mongo: field missing)
    cur.execute("SELECT count(*) FILTER (WHERE listing_mode='ban'), count(*) FILTER (WHERE listing_mode='thue'), count(*) FILTER (WHERE listing_mode IS NULL) FROM real_estates")
    sale_count, rent_count, no_mode_count = cur.fetchone()
    print(f"\nTotal Sale: {sale_count}")
    print(f"Total Rent: {rent_count}")
    print(f"Total No Mode: {no_mode_count}")

    print("\nStatus counts:")
    cur.execute("SELECT status, count(*) FROM real_estates GROUP BY status ORDER BY status")
    for status, count in cur.fetchall():
        print({'_id': status, 'count': count})
