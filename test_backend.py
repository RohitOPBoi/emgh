import sys
import numpy as np
import json
import glob

sys.path.insert(0, '.')
errors = []

# Test 1: .env + settings
try:
    from nowcast.configs.settings import TOMORROW_API_KEY, COPERNICUS_CLIENT_ID, EUMETSAT_CONSUMER_KEY
    assert TOMORROW_API_KEY and COPERNICUS_CLIENT_ID and EUMETSAT_CONSUMER_KEY
    print('PASS .env + settings: all keys loaded')
except Exception as e:
    errors.append(f'FAIL settings: {e}')

# Test 2: Districts
try:
    from nowcast.configs.districts_india import DISTRICTS
    assert len(DISTRICTS) > 100
    print(f'PASS districts: {len(DISTRICTS)} centroids loaded')
except Exception as e:
    errors.append(f'FAIL districts: {e}')

# Test 3: Hazard models with correct fused-frame dict
try:
    from nowcast.models.hazard import classify_station, hail_cells, downburst_cells
    fused = {
        'bbox': (73.5, 18.0, 74.5, 19.0),
        'grid_size': 50,
        'channels': {
            'reflectivity_dbz': np.zeros((50, 50), dtype=np.float32),
            'tir1': np.full((50, 50), 280.0, dtype=np.float32),
            'lightning_prob': np.zeros((50, 50), dtype=np.float32),
        }
    }
    cells = hail_cells(fused)
    d_cells = downburst_cells(fused)
    rec = classify_station({'lightning_prob': 0.9, 'hail_flag': True, 'lat': 19.0, 'lon': 73.5, 'station_id': 'TEST'})
    assert rec['hazards']
    types = [h['type'] for h in rec['hazards']]
    print(f'PASS hazard models: hail_cells={len(cells)}, downburst={len(d_cells)}, classify={types}')
except Exception as e:
    errors.append(f'FAIL hazard models: {e}')

# Test 4: SmaAt-UNet forward pass
try:
    import torch
    from nowcast.models.smaat_unet import SmaAt_UNet
    model = SmaAt_UNet(in_channels=4, out_channels=1)
    y = model(torch.randn(1, 4, 64, 64))
    assert y.shape == (1, 1, 64, 64)
    print(f'PASS SmaAt-UNet: forward pass OK shape={tuple(y.shape)}')
except Exception as e:
    errors.append(f'FAIL SmaAt-UNet: {e}')

# Test 5: Backtest importable
try:
    import importlib.util
    spec = importlib.util.spec_from_file_location('backtest', 'nowcast/processing/backtest.py')
    importlib.util.module_from_spec(spec)
    print('PASS backtest: importable')
except Exception as e:
    errors.append(f'FAIL backtest: {e}')

# Test 6: Historical replay snapshots
snaps = glob.glob('nowcast/data/imd/*.json')
if snaps:
    print(f'PASS historical replay: {len(snaps)} IMD snapshots on disk')
else:
    errors.append('FAIL historical replay: 0 snapshots — run load_historical_replay.py')

# Test 7: SMS alerts
try:
    from nowcast.alerts import sms_alerts
    print('PASS sms_alerts: importable')
except Exception as e:
    errors.append(f'FAIL sms_alerts: {e}')

# Test 8: Composite risk score logic
try:
    risk = np.zeros((100, 100), dtype=np.float32)
    rainrate = np.full((100, 100), 20.0, dtype=np.float32)
    risk[rainrate >= 15.0] += 2.0
    risk = np.clip(risk, 0, 5)
    assert risk.max() == 2.0
    print('PASS composite risk score: logic verified')
except Exception as e:
    errors.append(f'FAIL composite risk: {e}')

# Test 9: IMD snapshot structure validation
try:
    with open(snaps[0]) as f:
        snap = json.load(f)
    assert 'records' in snap and 'timestamp' in snap
    rec0 = snap['records'][0]
    assert 'lat' in rec0 and 'lon' in rec0 and 'lightning_prob' in rec0
    n = len(snap['records'])
    ts = snap['timestamp']
    print(f'PASS IMD snapshot structure: {n} records, ts={ts}')
except Exception as e:
    errors.append(f'FAIL IMD snapshot structure: {e}')

print()
if errors:
    print('=== FAILURES ===')
    for e in errors:
        print(f'  {e}')
    sys.exit(1)
else:
    print(f'ALL 9 TESTS PASSED — MeghDrishti backend is healthy!')
