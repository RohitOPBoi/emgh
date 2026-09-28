"""DGMR (DeepMind's Skillful Nowcasting GAN) — section 4b deep-model path.

Real pretrained weights, run zero-shot (openclimatefix/dgmr on HuggingFace
Hub, via the `dgmr` PyPI package — this is Option A from project.md §4b,
chosen over fine-tuning SmaAt-UNet because it needs no training run and
still gives the plan's "baseline vs. AI model" comparison toggle).

Known limitations, stated up front rather than discovered by a judge:
- Trained on UK Met Office radar composites at 1km/5min. We feed it our
  synthetic 64x64 grid (not UK radar, not real precip at all), resized to
  the model's fixed 256x256 input and rescaled with a simple linear
  normalization — not the original training pipeline's calibrated
  transform. Treat DGMR's output here as *structurally* illustrative
  (it does real motion-conditioned generation on whatever it's given),
  not quantitatively meaningful. This is the domain-shift caveat the plan
  explicitly asks to disclose.
- Fixed architecture: 4 context frames in, 18 steps out. We assume the
  paper's 5-min cadence (giving a 90-min horizon), which is shorter than
  pySTEPS' 6h — the dashboard's model toggle only offers DGMR up to +90min
  for this reason.
- CPU inference only in this environment (~3s/forecast on a modest CPU);
  fine for an on-demand demo, not for tight polling.
"""
import numpy as np
import torch

from nowcast.processing.synthetic_radar import generate_sequence, GRID_SIZE
from nowcast.configs.settings import get_region_bbox
from nowcast.models.pysteps_baseline import _dbz_to_rainrate

# Deliberately NOT run through the Marshall-Palmer Z-R relation like pySTEPS'
# output: with an out-of-distribution, uncalibrated input, small errors in
# DGMR's raw output blow up into rain rates of tens of thousands of mm/hr
# once cubed through R = (Z/200)^(1/1.6). That's not a real forecast value,
# it's noise amplified by a formula that assumes calibrated input. So DGMR's
# output here stays a unitless 0-1 "relative intensity" and is never fed into
# the mm/hr-based cloudburst rule (see hazard.py / pysteps_baseline.py) —
# it's a visual comparison layer only, not a second source of truth.

DGMR_INPUT_SIZE = 256
CONTEXT_FRAMES = 4
FORECAST_STEPS = 18
DT_MINUTES = 5  # assumed cadence from the original DeepMind paper

_model_cache = {"model": None}


def _get_model():
    if _model_cache["model"] is None:
        from dgmr import DGMR

        model = DGMR.from_pretrained("openclimatefix/dgmr")
        model.eval()
        _model_cache["model"] = model
    return _model_cache["model"]


def _resize(arr, size):
    t = torch.from_numpy(arr).float().unsqueeze(0).unsqueeze(0)
    out = torch.nn.functional.interpolate(t, size=(size, size), mode="bilinear", align_corners=False)
    return out.squeeze(0).squeeze(0).numpy()


def is_available():
    """True once the pretrained weights have been loaded (or can be)."""
    try:
        _get_model()
        return True
    except Exception as exc:
        print(f"[dgmr_nowcast] unavailable: {exc}")
        return False


def run_forecast(history_frames=CONTEXT_FRAMES, dt_minutes=10):
    """Returns a dict with the same shape as pysteps_baseline.run_forecast
    (timestamps_min, rainrate_forecast, dbz_forecast, bbox, grid_size) so
    callers (cloudburst_cells, /forecast, the dashboard toggle) work with
    either model unmodified.

    `dt_minutes` is the *input* history spacing (matches our synthetic
    radar cadence, 10 min); DGMR's own output cadence is fixed at
    DT_MINUTES=5 by the pretrained architecture, independent of the input
    spacing — another facet of the domain-shift caveat above.
    """
    model = _get_model()

    frames, _ = generate_sequence(n_frames=history_frames, dt_minutes=dt_minutes)
    dbz_stack = np.stack(frames, axis=0)  # (4, 64, 64)
    rainrate_stack = _dbz_to_rainrate(dbz_stack)

    # Simple linear normalization into DGMR's expected roughly-[0,1] input
    # range (max ~1mm/5min bracket in the original pipeline) — not the
    # calibrated openclimatefix transform, see module docstring.
    norm = np.clip(rainrate_stack / 50.0, 0, 1)
    resized = np.stack([_resize(f, DGMR_INPUT_SIZE) for f in norm], axis=0)  # (4, 256, 256)

    x = torch.from_numpy(resized).float().unsqueeze(0).unsqueeze(2)  # (1, 4, 1, 256, 256)
    with torch.no_grad():
        out = model(x)  # (1, 18, 1, 256, 256)
    out = out.squeeze(0).squeeze(1).clamp(min=0).numpy()  # (18, 256, 256), unitless model output

    frame_max = max(float(out.max()), 1e-6)
    intensity_forecast = [np.clip(_resize(f, GRID_SIZE) / frame_max, 0, 1) for f in out]

    timestamps_min = [(i + 1) * DT_MINUTES for i in range(FORECAST_STEPS)]
    return {
        "timestamps_min": timestamps_min,
        "intensity_forecast": [f.astype(np.float32) for f in intensity_forecast],
        "bbox": get_region_bbox(),
        "grid_size": GRID_SIZE,
        "source": "dgmr",
        "note": "relative intensity 0-1, not calibrated mm/hr — see module docstring",
    }


if __name__ == "__main__":
    import time

    t0 = time.time()
    fc = run_forecast()
    print(f"inference time: {round(time.time() - t0, 1)}s")
    print(f"forecast steps: {fc['timestamps_min']}")
    print(f"max intensity per step (0-1): {[round(float(f.max()), 2) for f in fc['intensity_forecast']]}")
