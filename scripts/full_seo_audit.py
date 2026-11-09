#!/usr/bin/env python3
import urllib.request
import json
import ssl
from datetime import datetime

SSL_CONTEXT = ssl._create_unverified_context()
BASE_URL = "https://internal.example:4000"

def fetch_json(path):
    try:
        req = urllib.request.urlopen(f"{BASE_URL}{path}", context=SSL_CONTEXT, timeout=15)
        return json.loads(req.read().decode('utf-8'))
    except Exception as e:
        return {"error": str(e)}

def run_audit():
    results = {}
    
    print("Fetching /api/domains...")
    results["domains"] = fetch_json("/api/domains")
    
    print("Fetching /api/crawls/stats...")
    results["crawls"] = fetch_json("/api/crawls/stats")
    
    print("Fetching /api/trending/clusters...")
    results["trending"] = fetch_json("/api/trending/clusters")
    
    print("Fetching /api/ai/analyze...")
    results["ai_analyze"] = fetch_json("/api/ai/analyze")
    
    print("Fetching /api/keywords?domain=nhadat.city...")
    results["keywords_nhadat"] = fetch_json("/api/keywords?domain=nhadat.city")
    
    print("Fetching /api/keywords?domain=xskt.com.vn...")
    results["keywords_xskt"] = fetch_json("/api/keywords?domain=xskt.com.vn")
    
    print("Fetching /api/serp/analyze?q=nha+dat+tphcm...")
    results["serp_bds"] = fetch_json("/api/serp/analyze?q=nha+dat+tphcm")
    
    print("Fetching /api/serp/analyze?q=ket+qua+xo+so...")
    results["serp_xoso"] = fetch_json("/api/serp/analyze?q=ket+qua+xo+so")

    with open("/home/hoan/DATA/nhadat-next/scripts/audit_output.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
        
    print("Audit complete! Saved to audit_output.json")

if __name__ == "__main__":
    run_audit()
