# TRACER (vendored)

This folder holds TRACER's model code: "TRACER: Extreme Attention Guided Salient Object Tracing Network", by Min Seok
Lee and Wooseok Shin, https://github.com/Karel911/TRACER, copyright 2021 Min Seok (Karel) Lee, under the Apache License
2.0 (LICENSE, beside this file). Taken from the repository's default branch on 29 Oct 2026: model/TRACER.py,
model/EfficientNet.py, modules/att_modules.py, modules/conv_modules.py, util/effi_utils.py.

Changes made for Marker Studio (the model's maps are unchanged: checked against an export of the original code to
within 4e-4 on real photos):
- Imports made relative to this package; the settings TRACER reads from the command line (config.py) fixed in cfg.py
  at their defaults, with the arch per model (cfg_for: TE-0, TE-1 or TE-2 beside each other in one process; their
  input sizes, 320, 320 and 352, from upstream's README). get_model_shape, EfficientNet and TRACER take the arch they
  are built for instead of reading a global one (TE-2 checked against the original code at 352 to within 3e-6, no
  pixel on the other side of 0.5, dev/equiv_upstream.py).
- TRACER.py: the backbone built with EfficientNet.from_name instead of from_pretrained (its weights come from TRACER's
  own release, loaded after, so no ImageNet download).
- att_modules.py, Frequency_Edge_Module.forward: the FFT high-pass rewritten as discrete Fourier transform matrix
  products (the same sums), in float32 even under mixed precision, with the radial mask built in numpy; no .cuda().
- att_modules.py, UnionAttentionModule.masking: torch.quantile (linear interpolation) as a sort with the same
  interpolation; the in-place zeroing as torch.where.
- att_modules.py, ObjectAttention.forward: the in-place `edge[edge > cfg.denoise] = 0` as torch.where.
