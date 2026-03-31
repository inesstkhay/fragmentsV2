import json
import csv

# fichiers
geojson_path = "datam.geojson"
csv_path = "elements_spatiauxm.csv"
output_path = "datam_enrichi.geojson"

# 1. lire le CSV et créer une table id -> elements_spatiaux
elements_by_id = {}

with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
        fid = row["id"].strip()
        elements = row["elements_spatiaux"].strip()
        elements_by_id[fid] = elements

# 2. lire le GeoJSON
with open(geojson_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# 3. injecter la nouvelle propriété
for feature in data["features"]:
    props = feature.get("properties", {})
    fid = str(props.get("id", "")).strip()
    props["elements_spatiaux"] = elements_by_id.get(fid, "")

# 4. sauvegarder
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Fichier enrichi écrit : {output_path}")