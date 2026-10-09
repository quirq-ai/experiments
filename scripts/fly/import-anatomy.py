"""Download a small, attributed MaleCNS v1.0 anatomical sample.

Source coordinate units (8 nm) documented at https://male-cns.janelia.org/download/.
This data is anatomy only, never a claim about the expedition controller.
"""
import json
from pathlib import Path
from urllib.request import urlopen

BASE = 'https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/'
neurons = []
for body_id, name in [(12781, 'DNge104_R'), (556329, 'DNge104_L')]:
    with urlopen(f'{BASE}{body_id}.swc', timeout=30) as response:
        raw = response.read(3_000_000).decode()
    nodes = []
    for line in raw.splitlines():
        if not line.strip() or line.startswith('#'):
            continue
        values = line.split()
        if len(values) >= 7:
            nodes.append([int(values[0]), *[float(v) * .008 for v in values[2:6]], int(values[6])])
    neurons.append({'bodyId': body_id, 'type': name, 'nodes': nodes})
output = {
    'dataset': 'MaleCNS v1.0', 'license': 'CC BY 4.0', 'units': 'micrometers',
    'source': 'https://male-cns.janelia.org/download/', 'sourceCoordinateUnits': '8 nm',
    'description': 'Two descending neuron skeletons, anatomical data only. Not the expedition controller. Coordinates converted from 8 nm voxels to micrometers.',
    'neurons': neurons,
}
target = Path(__file__).resolve().parents[2] / 'public/fly/malecns-sample.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(output, separators=(',', ':')))
print(f'{target}: {sum(len(n["nodes"]) for n in neurons)} nodes')
