from pg_source import connect

with connect() as conn:
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM real_estates WHERE price < 50000000 AND price > 1000000")
    print(f"Listings with price between 1M and 50M: {cur.fetchone()[0]}")

    cur.execute("SELECT title, description FROM real_estates WHERE price < 50000000 AND price > 1000000 LIMIT 1")
    row = cur.fetchone()
    if row:
        print(f"Sample title: {row[0]}")
        print(f"Sample desc: {row[1]}")
