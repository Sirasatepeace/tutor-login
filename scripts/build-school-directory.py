#!/usr/bin/env python3
"""Build the public name/location-only snapshot from downloaded official files.

Requires Python + openpyxl. Download the three files documented in
SCHOOL-DATA-SOURCES.md, then pass their directory as the first argument.
No phone numbers, contacts, coordinates, or pupil statistics are published.
"""
import collections
import csv
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
INPUT = Path(sys.argv[1])
OUTPUT = ROOT / "public/data/thai-schools-20261021.json"
SOURCES = [
    {
        "id": "obec-2569",
        "publisher": "สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน",
        "asOf": "2026-06-10",
        "catalog": "https://web2.bopp.go.th/?page_id=878",
        "download": "https://web2.bopp.go.th/wp-content/uploads/2026/07/DMC691.xlsx",
        "filename": "obec-2569.xlsx",
    },
    {
        "id": "dla-2569",
        "publisher": "กรมส่งเสริมการปกครองท้องถิ่น",
        "asOf": "2026-05-20",
        "catalog": "https://gdcatalog.go.th/dataset/gdpublish-school9",
        "download": "https://opendata.dla.go.th/dataset/faabac25-137f-4bea-999f-b65f0aeee6fe/resource/e1c5f298-529e-431c-b4aa-62319dbb2057/download/untitled.csv",
        "filename": "dla-2569.csv",
        "license": "Open Data Common (catalogue label)",
    },
    {
        "id": "moe-2558",
        "publisher": "สำนักงานปลัดกระทรวงศึกษาธิการ",
        "asOf": "2015",
        "catalog": "https://data.go.th/th/dataset/item_8548e3ab-00bf-4eae-b29a-156a4aa52c0d",
        "download": "https://data.go.th/dataset/611d93c1-0f23-44e9-b6a2-990aedea478e/resource/09a651f1-1182-4438-b0a2-993699f72b2e/download/exportschoolclickedu_2.xlsx",
        "filename": "moe-2558-official.xlsx",
        "license": "Creative Commons Attributions (catalogue label)",
        "note": "Historical supplement for other school sectors and vocational education; not a current active-school register.",
    },
]


def clean(value):
    text = unicodedata.normalize("NFKC", str(value if value is not None else ""))
    text = re.sub(r"[\u200b-\u200d\ufeff]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def key(value):
    return re.sub(r"[\s\"'“”‘’()]+", "", re.sub(r"^โรงเรียน\s*", "", value)).casefold()


def rows(filename):
    workbook = openpyxl.load_workbook(INPUT / filename, read_only=True, data_only=True)
    try:
        iterator = workbook.active.values
        next(iterator)
        yield from iterator
    finally:
        workbook.close()


obec = list(rows("obec-2569.xlsx"))
provinces = {clean(row[8]) for row in obec if row[6] and row[8]}
assert len(provinces) == 77, "Unexpected province coverage in current OBEC input"
records = {}
by_id = {}
rejected = collections.Counter()


def add(identifier, name, province, district, source, prefix=True):
    name, province, district = map(clean, (name, province, district))
    if province in ("-", "ค่าว่าง"):
        province = ""
    if not name or (province and province not in provinces):
        rejected[source] += 1
        return
    if district in ("-", "ค่าว่าง"):
        district = ""
    if prefix and not name.startswith(("โรงเรียน", "วิทยาลัย", "สถาบัน", "ศูนย์")):
        name = "โรงเรียน" + name
    identity = (key(name), province, district)
    identifier = clean(identifier)
    identifier = identifier.removesuffix(".0")
    if not re.fullmatch(r"\d{10}", identifier):
        identifier = "loc-" + hashlib.sha256("|".join(identity).encode()).hexdigest()[:16]
    # A later source is more recent. Keep one suggestion for identical name/location.
    if identifier in by_id:
        records.pop(by_id[identifier], None)
    old = records.get(identity)
    if old:
        by_id.pop(old[0], None)
    records[identity] = [identifier, name, province, district, source]
    by_id[identifier] = identity


# Use the nationwide 2015 register only for sectors without a fresh open list.
# Replace its OBEC/local-government sectors completely with the 2026 lists.
excluded_departments = {clean(department) for department in [
    "สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน",
    "กรมส่งเสริมการปกครองท้องถิ่น",
    "สำนักงานส่งเสริมการศึกษานอกระบบและการศึกษาตามอัธยาศัย",
]}
for row in rows("moe-2558-official.xlsx"):
    school_type, department = clean(row[6]), clean(row[7])
    if department in excluded_departments:
        continue
    if not (school_type.startswith("โรงเรียน") or department == clean("สำนักงานคณะกรรมการการอาชีวศึกษา")):
        continue
    add(row[0], row[1], row[4], row[3], "moe-2558", school_type.startswith("โรงเรียน"))

for row in obec:
    add(row[5], row[6], row[8], row[7], "obec-2569")

with (INPUT / "dla-2569.csv").open(encoding="utf-8-sig", newline="") as handle:
    for row in csv.DictReader(handle):
        add("", row["ชื่อสถานศึกษา"], row["จังหวัด"], row["อำเภอ"], "dla-2569")

result = sorted(records.values(), key=lambda row: (row[1], row[2], row[3], row[0]))
counts = collections.Counter(row[4] for row in result)
for source in SOURCES:
    source["sha256"] = hashlib.sha256((INPUT / source["filename"]).read_bytes()).hexdigest()
    source["suggestionCount"] = counts[source["id"]]

directory = {
    "schema": 1,
    "generatedAt": "2026-10-21",
    "count": len(result),
    "provinceCount": len({row[2] for row in result if row[2]}),
    "coverage": "Nationwide open-data snapshot; some sectors use historical names. Completeness and current operation of every school are not guaranteed. Manual entry is supported.",
    "columns": ["id", "name", "province", "district"],
    "sources": SOURCES,
    "schools": [row[:4] for row in result],
}
assert len({row[0] for row in result}) == len(result), "Duplicate suggestion IDs"
assert len(result) > 30000, "Unexpectedly small directory"
assert max(len(row[1]) + len(row[2]) + 3 for row in result) <= 200
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(directory, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(json.dumps({"count": len(result), "provinces": directory["provinceCount"], "sources": counts, "skippedMissingNameOrProvince": rejected, "bytes": OUTPUT.stat().st_size}, ensure_ascii=False))
