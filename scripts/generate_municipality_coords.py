import asyncio
import os
import sys
import json
import re
from typing import Dict, Tuple

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

import httpx

async def generate_coords():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    frontend_const_path = os.path.join(root_dir, 'frontend/src/constants/municipalityCodes.ts')
    
    with open(frontend_const_path, 'r') as f:
        content = f.read()
    
    matches = re.findall(r"code: '(\d+)', name: '([^']+)'", content)
    
    coords: Dict[str, Tuple[float, float]] = {}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        print(f"Processing {len(matches)} municipalities...")
        
        # Process in batches to avoid overwhelming the API
        batch_size = 20
        for i in range(0, len(matches), batch_size):
            batch = matches[i:i+batch_size]
            tasks = []
            for code, name in batch:
                url = f"https://ws.geonorge.no/kommuneinfo/v1/kommuner/{code}"
                tasks.append((code, client.get(url)))
                
            results = await asyncio.gather(*(t[1] for t in tasks), return_exceptions=True)
            
            for (code, _), response in zip(batch, results):
                if isinstance(response, httpx.Response) and response.status_code == 200:
                    data = response.json()
                    punkt = data.get("punktIOmrade", {})
                    pos = punkt.get("coordinates")
                    if pos and len(pos) == 2:
                        # Geonorge returns [lon, lat]. We store as (lat, lon) for Leaflet/Backend
                        coords[code] = (pos[1], pos[0])
                        print(f"✅ {code} ({data.get('kommunenavn')}): {coords[code]}")
                    else:
                        print(f"⚠️ {code} has no point")
                else:
                    print(f"❌ {code} failed: {response}")
            
            await asyncio.sleep(0.2)

    # Write to constants file
    output_path = os.path.join(root_dir, 'backend/constants/municipality_coords.py')
    with open(output_path, 'w') as f:
        f.write('"""Static coordinates for Norwegian municipalities (Centroids).\n\nGenerated using Geonorge API.\n"""\n\n')
        f.write('MUNICIPALITY_COORDS = {\n')
        for code, (lat, lon) in sorted(coords.items()):
            f.write(f'    "{code}": ({lat}, {lon}),\n')
        f.write('}\n')
    
    print(f"Done! Saved {len(coords)} coordinates to {output_path}")

if __name__ == "__main__":
    asyncio.run(generate_coords())
