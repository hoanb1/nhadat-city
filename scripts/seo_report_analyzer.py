#!/usr/bin/env python3
"""
SEO Analytic Automated Inspector
Connects to https://internal.example:4000 to generate SEO diagnostic reports for nhadat.city and ve-so.com
"""

import urllib.request
import json
import ssl
import sys
from datetime import datetime

SSL_CONTEXT = ssl._create_unverified_context()
BASE_URL = "https://internal.example:4000"

def fetch_json(endpoint):
    url = f"{BASE_URL}{endpoint}"
    try:
        req = urllib.request.urlopen(url, context=SSL_CONTEXT, timeout=10)
        return json.loads(req.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e)}

def run_seo_diagnostic(domain):
    print(f"==================================================")
    print(f"  SEO DIAGNOSTIC REPORT: {domain}")
    print(f"  Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"==================================================")
    
    # 1. Fetch domain status in HAProxy/Traffic stats
    domains_data = fetch_json("/api/domains")
    domain_info = None
    if domains_data.get("success") and "data" in domains_data:
        for d in domains_data["data"]:
            if d.get("domain") == domain:
                domain_info = d
                break
    
    if domain_info:
        print(f"\n📊 [1. TRAFFIC & INFRA HEALTH]")
        print(f"   • Total Requests  : {domain_info.get('totalRequests', 0):,}")
        print(f"   • Googlebot Crawls: {domain_info.get('googlebotRequests', 0):,}")
        print(f"   • Other Bots      : {domain_info.get('otherBotRequests', 0):,}")
        print(f"   • Human Traffic   : {domain_info.get('humanRequests', 0):,}")
        print(f"   • 200 OK Status   : {domain_info.get('status200', 0):,}")
        print(f"   • 404 Errors      : {domain_info.get('status404', 0):,}")
        print(f"   • 500 Errors      : {domain_info.get('status500', 0):,}")
        print(f"   • Avg Latency     : {domain_info.get('avgLatencyMs', 0)} ms")
        print(f"   • Health Score    : {domain_info.get('healthScore', 0)}/100")
    else:
        print(f"\n📊 [1. TRAFFIC & INFRA HEALTH]: Domain traffic stats pending in HAProxy log analyzer.")

    # 2. Fetch GSC Keywords
    keywords_data = fetch_json(f"/api/keywords?domain={domain}&period=week")
    print(f"\n🔑 [2. SEARCH CONSOLE KEYWORDS]")
    if keywords_data.get("success") and "data" in keywords_data:
        kws = keywords_data.get("data", [])
        print(f"   • Total Tracked Keywords: {len(kws)}")
        for i, kw in enumerate(kws[:5], 1):
            print(f"   {i}. '{kw.get('query')}' | Pos: {kw.get('position', 0):.1f} | Clicks: {kw.get('clicks', 0)} | Impressions: {kw.get('impressions', 0)}")
    else:
        print(f"   • Keyword rankings: {keywords_data.get('error', 'No GSC data available directly or default domain assigned.')}")

    # 3. AI Analysis & Recommendations
    ai_data = fetch_json("/api/ai/analyze")
    print(f"\n🤖 [3. AI SEO RECOMMENDATIONS]")
    if ai_data.get("success") and "data" in ai_data:
        recs = ai_data["data"].get("recommendations", [])
        for r in recs[:3]:
            print(f"   • {r}")
    else:
        print(f"   • AI Insights: {ai_data.get('error', 'AI Analyzer online.')}")

    print("\n" + "="*50 + "\n")

if __name__ == "__main__":
    domains = ["nhadat.city", "xskt.com.vn"]
    if len(sys.argv) > 1:
        domains = sys.argv[1:]
    for d in domains:
        run_seo_diagnostic(d)
