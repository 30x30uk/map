#!/usr/bin/env python3
"""
export_and_cache_images.py  (id-based caching)

• Downloads Airtable records
• For the first attachment in 'Image':
      - if project-img/<attId>.webp already exists ➜ reuse it
      - else download, convert to WebP, save as that filename
• Emits projects.json with local, permanent image URLs
"""

import io, json, os, sys, time, hashlib
from pathlib import Path
from urllib.parse import quote, urlencode

import requests
from PIL import Image

# ───── env config ────────────────────────────────────────────────────────────
BASE_ID  = os.getenv("AT_BASE_ID")  or sys.exit("Missing AT_BASE_ID")
TOKEN    = os.getenv("AT_TOKEN")    or sys.exit("Missing AT_TOKEN")
TABLE    = os.getenv("AT_TABLE", "Projects")
VIEW     = os.getenv("AT_VIEW",  "Approved")
OUT_JSON = os.getenv("OUT_FILE", "projects.json")
IMG_DIR  = Path("project-img")
IMG_DIR.mkdir(exist_ok=True)

API      = f"https://api.airtable.com/v0/{BASE_ID}"
HEADERS  = {"Authorization": f"Bearer {TOKEN}"}

# ───── helpers ───────────────────────────────────────────────────────────────
def fetch_records():
    params = {"view": VIEW, "pageSize": 100, "cellFormat": "json"}
    url = f"{API}/{quote(TABLE)}?{urlencode(params, doseq=True)}"
    while url:
        r = requests.get(url, headers=HEADERS, timeout=20); r.raise_for_status()
        data = r.json(); yield from data["records"]
        url = data.get("offset")
        if url:
            url = f"{API}/{quote(TABLE)}?{urlencode(params)}&offset={url}"
            time.sleep(0.3)

def optimise(raw, max_w=1600):
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    if im.width > max_w:
        ratio = max_w / im.width
        im = im.resize((max_w, int(im.height * ratio)))
    buf = io.BytesIO(); im.save(buf, "WEBP", quality=80, method=6)
    return buf.getvalue()

def cache_image(att):
    fname = f"{att['id']}.webp"             # deterministic by attachment id
    path  = IMG_DIR / fname

    # ➊ already cached?
    if path.exists():
        return f"{IMG_DIR.name}/{fname}"

    # ➋ download, convert, save
    raw  = requests.get(att["url"], timeout=30).content
    webp = optimise(raw)
    path.write_bytes(webp)
    return f"{IMG_DIR.name}/{fname}"

# ───── main loop ─────────────────────────────────────────────────────────────
records_out, img_count = [], 0

for rec in fetch_records():
    f = rec["fields"]

    fieldsToRemove = ["Google Link", "VolunteeringDescription", "Start", "End", "VolunteeringLocationURL", "VolunteeringCost", "Month", "ContactEmailAddressOrWebpage", "Approved", "Description"]
    for fieldToRemove in fieldsToRemove:            # records = list[dict]
        if fieldToRemove in f and f[fieldToRemove]:
            del f[fieldToRemove]

    if "Image" in f and f["Image"]:
        try:
            local = cache_image(f["Image"][0])
            f["Image"][0] = {"url": local}
            img_count += 1
        except Exception as e:
            print(f"[warn] {f.get('Name','(no name)')}: {e}")

    f["Description"] = f["DescriptionVolunteeringFallback"]
    del f["DescriptionVolunteeringFallback"]

    records_out.append({"id": rec["id"], **f})

with open(OUT_JSON, "w", encoding="utf-8") as fp:
    json.dump(records_out, fp, ensure_ascii=False, indent=2)

print(f"✔ wrote {len(records_out)} records to {OUT_JSON}")
print(f"✔ ensured {img_count} images in {IMG_DIR}/")
