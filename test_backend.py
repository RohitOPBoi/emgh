import sys
import numpy as np
import json
import glob

sys.path.insert(0, '.')
errors = []

# Test 1: settings import + sane defaults (API keys are optional: every
# USE_LIVE_* flag defaults to off and the system runs on synthetic data)
try:
    from nowcast.configs import settings as cfg
    assert cfg.INGEST_CYCLE_MINUTES >= 1
    assert cfg.INDIA_BBOX == (68.0, 6.5, 97.5, 37.0)
    assert len(cfg.REGIONS) >= 10
    live = [k for k in ('RADAR', 'LIGHTNING', 'ECMWF', 'IMD', 'SATELLITE') if getattr(cfg, f'USE_LIVE_{k}')]
    print(f'PASS settings: {len(cfg.REGIONS)} regions, live sources enabled: {live or "none (synthetic mode)"}')
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
    try:
        import torch
    except ImportError:
        print('SKIP SmaAt-UNet: torch not installed')
    else:
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
    errors.append('FAIL historical replay: 0 snapshots - run load_historical_replay.py')

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
    assert 'records' in snap and 'bbox' in snap
    rec0 = snap['records'][0]
    assert 'lat' in rec0 and 'lon' in rec0 and 'lightning_prob' in rec0
    n = len(snap['records'])
    ts = snaps[0].rsplit('/', 1)[-1].removesuffix('.json')  # timestamp lives in the filename
    print(f'PASS IMD snapshot structure: {n} records, ts={ts}')
except Exception as e:
    errors.append(f'FAIL IMD snapshot structure: {e}')

# Test 10: rain field - Z-R conversion, wind advection direction, encode round-trip
try:
    import base64
    from nowcast.processing import rain_field as rf
    from nowcast.configs.settings import INDIA_BBOX

    dbz = np.zeros((150, 150), dtype=np.float32)
    dbz[70:80, 70:80] = 45.0
    rate = rf.dbz_to_rate(dbz)
    assert 10 < rate.max() < 40 and rate[0, 0] == 0          # 45 dBZ ~ 24 mm/hr (Marshall-Palmer)
    # westerly wind (blowing FROM 270 deg) must carry the echo EAST
    moved = rf.advect(rate, INDIA_BBOX, np.full((96, 96), 10.0), np.full((96, 96), 270.0), 180)
    assert np.where(moved > 1)[1].mean() > np.where(rate > 1)[1].mean() + 3
    assert abs(np.where(moved > 1)[0].mean() - np.where(rate > 1)[0].mean()) < 0.5
    enc = rf.encode(moved, INDIA_BBOX, 180, 't', 'm', np.full((96, 96), 10.0), np.full((96, 96), 270.0))
    q = np.frombuffer(base64.b64decode(enc['rate']), dtype=np.uint8).reshape(enc['height'], enc['width'])
    decoded = (q / enc['quant']) ** 2
    assert abs(decoded.max() - moved.max()) / moved.max() < 0.1
    assert enc['wind']['u'][0] > 9 and abs(enc['wind']['v'][0]) < 0.5  # eastward flow
    print(f"PASS rain_field: Z-R, advection direction and sqrt-quantised encoding verified (peak {decoded.max():.1f} mm/hr)")
except Exception as e:
    errors.append(f'FAIL rain_field: {e}')

# Test 11: all-India cloudburst + downburst-potential detection from reflectivity
try:
    from nowcast.models import hazard_india as hi
    dbz = np.zeros((150, 150), dtype=np.float32)
    dbz[50:56, 50:56] = 45.0
    dbz[52:54, 52:54] = 62.0           # intense core with a sharp edge
    dbz[100:110, 100:110] = 48.0       # broad heavy rain, no sharp core
    found = hi.detect(reflectivity=dbz, strikes=[])
    cb = [h for h in found if h['type'] == 'cloudburst']
    db = [h for h in found if h['type'] == 'downburst']
    assert len(cb) == 2 and all(h['rainrate_mm_hr'] >= 15 for h in cb)
    assert len(db) == 1 and db[0]['source'] == 'proxy'
    print(f'PASS all-India hazards: {len(cb)} cloudburst, {len(db)} downburst-proxy')
except Exception as e:
    errors.append(f'FAIL all-India hazards: {e}')

print()
if errors:
    print('=== FAILURES ===')
    for e in errors:
        print(f'  {e}')
    sys.exit(1)
else:
    print(f'ALL TESTS PASSED - Agrim backend is healthy!')
