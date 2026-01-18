import json

with open('public/norway-municipalities.geojson', 'r') as f:
    data = json.load(f)

municipalities = []
for feature in data['features']:
    props = feature['properties']
    municipalities.append({
        'code': props['kommunenummer'],
        'name': props['name'].upper()
    })

# Sort by name
municipalities.sort(key=lambda x: x['name'])

print("export const MUNICIPALITIES = [")
for m in municipalities:
    print(f"    {{ code: '{m['code']}', name: '{m['name']}' }},")
print("] as const")
