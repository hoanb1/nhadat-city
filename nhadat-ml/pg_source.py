"""PostgreSQL data source for the ML scripts (replaces pymongo).

load_listings() reads public.real_estates and rebuilds the legacy Mongo
`realEstate` document shape (camelCase, nested adminunit, GeoJSON-ish
coordinates [lng, lat], dynamicFields list, extra fields merged at top level)
so downstream feature code is unchanged.

Env: DATABASE_URL (required, fail fast). Falls back to reading ./.env next to
this file if the variable is not already exported.
"""
import os
from decimal import Decimal

import psycopg

ITERSIZE = 5000

# mongo field -> SQL column (simple 1:1)
_SIMPLE = {
    "shortId": "short_id", "slug": "slug", "status": "status",
    "listingMode": "listing_mode", "propertyType": "property_type",
    "title": "title", "description": "description", "area": "area",
    "price": "price", "totalPrice": "total_price", "pricePerM2": "price_per_m2",
    "legalDocs": "legal_docs", "direction": "direction", "address": "address",
    "images": "images", "thumbnailUrl": "thumbnail_url", "contact": "contact",
    "userType": "user_type", "isScraped": "is_scraped", "views": "views",
    "postDuration": "post_duration", "dynamicFields": "dynamic_fields",
    "createdAt": "created_at", "updatedAt": "updated_at", "postedAt": "posted_at",
    "publishedAt": "published_at", "expireAt": "expire_at",
}
_NUMERIC = {"price", "totalPrice", "pricePerM2"}
_COMPOSITE = {
    "_id": ("mongo_id", "id"),
    "adminunit": ("province_slug", "district_slug", "ward_slug"),
    "oldadminunit": ("old_province_slug", "old_district_slug", "old_ward_slug"),
    "coordinates": ("longitude", "latitude"),
}
_LISTING_MODE_OUT = {"thue": "cho_thue"}  # ETL stores the RAW Mongo value (e.g. 'cho_thue'); normalize legacy 'thue' on read
_LISTING_MODE_IN = {}  # no translation: filters use the raw Mongo values stored by ETL/scraper


def _env_url():
    url = os.environ.get("DATABASE_URL")
    if not url:
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
        if os.path.exists(p):
            for line in open(p, encoding="utf-8"):
                line = line.strip()
                if line.startswith("DATABASE_URL="):
                    url = line.split("=", 1)[1].strip().strip("'\"")
    if not url:
        raise RuntimeError("DATABASE_URL is not set (postgres://user:pass@host:5432/db)")
    return url


def connect():
    return psycopg.connect(_env_url(), autocommit=False)


def _col(field):
    """SQL expression for a Mongo top-level field (unknown fields live in extra)."""
    if field in _SIMPLE:
        return _SIMPLE[field]
    if field.isidentifier():
        return f"extra->'{field}'"
    raise ValueError(f"bad field name: {field!r}")


def _where(flt):
    """Translate a Mongo-style filter into (sql, params).
    Supports $gte/$gt/$lte/$lt/$ne/$in/$nin/$exists and scalar equality."""
    if not flt:
        return "TRUE", []
    parts, params = [], []
    ops = {"$gte": ">=", "$gt": ">", "$lte": "<=", "$lt": "<"}
    for field, cond in flt.items():
        if field == "_id":
            expr = "mongo_id"
        else:
            expr = _col(field)
        is_extra = expr.startswith("extra->")
        conds = cond if isinstance(cond, dict) and any(k.startswith("$") for k in cond) else {"$eq": cond}
        for op, val in conds.items():
            if field == "listingMode":
                val = ([_LISTING_MODE_IN.get(v, v) for v in val] if isinstance(val, (list, tuple))
                       else _LISTING_MODE_IN.get(val, val))
            if op in ops:
                parts.append(f"{expr} {ops[op]} %s")
                params.append(val)
            elif op == "$eq":
                if val is None:
                    parts.append(f"{expr} IS NULL")
                elif field == "listingMode" and val == "ban":
                    parts.append("(listing_mode = 'ban' OR listing_mode IS NULL)")  # 'ban' is default
                else:
                    parts.append(f"{expr} = %s")
                    params.append(val)
            elif op == "$ne":
                parts.append(f"{expr} IS DISTINCT FROM %s")
                params.append(val)
            elif op == "$in":
                parts.append(f"{expr} = ANY(%s)")
                params.append(list(val))
            elif op == "$nin":
                parts.append(f"NOT ({expr} = ANY(%s))")
                params.append(list(val))
            elif op == "$exists":
                # typed columns: "exists" == NOT NULL (shortId, listingMode...)
                parts.append(f"{expr} IS {'NOT ' if val else ''}NULL")
            else:
                raise ValueError(f"unsupported operator {op}")
    return " AND ".join(parts), params


_ORDER = {"createdAt": "created_at", "updatedAt": "updated_at", "id": "id"}


def load_listings(filter=None, limit=None, columns=None, order_by=("createdAt", -1),
                  itersize=ITERSIZE, cursor_name="ml_listings"):
    """Yield Mongo-shaped dict per real_estates row (server-side cursor, bounded memory).

    columns: iterable of Mongo field names to return (default: all typed fields + extra).
    order_by: (field, 1|-1) or None (skip the sort; cheaper on millions of rows).
    """
    full = columns is None
    want = None if full else list(columns)
    sel, plan = [], []  # plan: (kind, field, n_cols)

    def add(kind, field, exprs):
        sel.extend(exprs)
        plan.append((kind, field, len(exprs)))

    if full:
        add("composite", "_id", _COMPOSITE["_id"])
        for f, c in _SIMPLE.items():
            add("simple", f, [c])
        for f in ("adminunit", "oldadminunit", "coordinates"):
            add("composite", f, _COMPOSITE[f])
        add("extra", None, ["extra"])
    else:
        for f in want:
            if f in _COMPOSITE:
                add("composite", f, _COMPOSITE[f])
            elif f in _SIMPLE:
                add("simple", f, [_SIMPLE[f]])
            else:
                add("extrafield", f, [_col(f)])

    where, params = _where(filter)
    sql = f"SELECT {', '.join(sel)} FROM real_estates WHERE {where}"
    if order_by:
        f, d = order_by
        sql += f" ORDER BY {_ORDER[f]} {'DESC' if d < 0 else 'ASC'}"
    if limit:
        sql += " LIMIT %s"
        params = params + [int(limit)]

    with connect() as conn:
        with conn.cursor(name=cursor_name) as cur:  # named => server-side
            cur.itersize = itersize
            cur.execute(sql, params)
            for row in cur:
                yield _build(row, plan)


def _build(row, plan):
    doc, i = {}, 0
    for kind, field, n in plan:
        vals = row[i:i + n]
        i += n
        if kind == "simple":
            v = vals[0]
            if isinstance(v, Decimal):
                v = float(v)
            if field == "listingMode":
                v = _LISTING_MODE_OUT.get(v, v) if v else "ban"
            doc[field] = v
        elif kind == "extra":
            for k, v in (vals[0] or {}).items():
                doc.setdefault(k, v)
        elif kind == "extrafield":
            doc[field] = vals[0]
        elif field == "_id":
            doc["_id"] = vals[0] if vals[0] is not None else str(vals[1])
        elif field in ("adminunit", "oldadminunit"):
            doc[field] = {"province": vals[0], "district": vals[1], "ward": vals[2]}
        elif field == "coordinates":
            doc["coordinates"] = ([vals[0], vals[1]] if vals[0] is not None and vals[1] is not None else [])
    return doc
