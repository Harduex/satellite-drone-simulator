"""Compact Natural Earth country polygons and settlement points for offline HUD labels."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("countries", type=Path)
parser.add_argument("settlements", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
countries = json.loads(args.countries.read_bytes())
settlements = json.loads(args.settlements.read_bytes())
output = {"countries": [], "settlements": []}
for feature in countries["features"]:
    props, geometry = feature["properties"], feature["geometry"]
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    output["countries"].append({"code": props["ADM0_A3"], "name": props["NAME_EN"], "polygons": polygons})
for feature in settlements["features"]:
    props = feature["properties"]
    lng, lat = feature["geometry"]["coordinates"]
    output["settlements"].append({"lat": round(lat, 4), "lng": round(lng, 4),
        "name": props["name"], "region": props["adm1name"] or "",
        "country": props["adm0name"], "code": props["adm0_a3"]})
args.output.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
for source in [args.countries, args.settlements]:
    print(f"{source.name} SHA256: {hashlib.sha256(source.read_bytes()).hexdigest()}")
print(f"Prepared {len(output['countries'])} countries, {len(output['settlements'])} settlements; {args.output.stat().st_size} bytes")
