#!/usr/bin/env python3
import os
import sys
import json
import urllib.request

def load_env(env_path):
    if not os.path.exists(env_path):
        return {}
    env = {}
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, val = line.split('=', 1)
                env[key.strip()] = val.strip().replace('"', '').replace("'", "")
    return env

def main():
    if len(sys.argv) < 2:
        print("Usage: purge_cache_api.py [url1] [url2] ...")
        sys.exit(1)
        
    urls = sys.argv[1:]
    
    # Try to load from local .env.local first
    env = load_env('.env.local')
    token = os.environ.get('CLOUDFLARE_API_TOKEN') or env.get('CLOUDFLARE_API_TOKEN')
    zone_id = os.environ.get('CLOUDFLARE_ZONE_ID') or env.get('CLOUDFLARE_ZONE_ID')
    
    if not token or not zone_id:
        print("Error: CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID not found in environment or .env.local")
        sys.exit(1)
        
    api_url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache"
    payload = {"files": urls}
    
    req = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as res:
            res_data = json.loads(res.read().decode('utf-8'))
            if res_data.get('success'):
                print("✅ Successfully purged cache for URLs:")
                for url in urls:
                    print(f"  - {url}")
            else:
                print("❌ Failed to purge cache:", json.dumps(res_data.get('errors')))
    except Exception as e:
        print("❌ Error sending API request:", e)
        sys.exit(1)

if __name__ == "__main__":
    main()
