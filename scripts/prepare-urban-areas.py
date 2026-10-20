"""Prepare Natural Earth urban polygons; run with Shapely 2.1.2."""
import argparse
import hashlib
import json
from pathlib import Path

from shapely.geometry import shape

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
source = args.source.read_bytes()
polygons = []
for feature in json.loads(source)["features"]:
    geometry = shape(feature["geometry"]).simplify(0.001, preserve_topology=True)
    parts = [geometry] if geometry.geom_type == "Polygon" else geometry.geoms
    for polygon in parts:
        rings = [polygon.exterior, *polygon.interiors]
        polygons.append([[[round(x, 4), round(y, 4)] for x, y in ring.coords] for ring in rings])
args.output.write_text(json.dumps(polygons, separators=(",", ":")), encoding="utf-8")
print(f"Source SHA256: {hashlib.sha256(source).hexdigest()}")
print(f"Prepared {len(polygons)} polygons; {args.output.stat().st_size} bytes")
