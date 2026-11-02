# Subject finder (vendored)

What a photo-made colouring page's **Focus** (Sharper subject, Simpler background, Subject only) runs, on the device: a
salient object detection model, which says how much each part of a photo is its subject (from v329.2 TRACER-TE0;
before, U²-Net's small model). The app's code that uses it is in
`src/js/guide/48-subject.js`. Downloaded only when someone chooses one of those, after a consent card, into a cache of
its own (`marker-studio-subject-<version>`), which an app update leaves alone; the service worker never stores it in the
app's cache. It runs on ONNX Runtime Web, the photo reader's own copy (`vendor/ocr/1/`: its two `ort` files, kept in
the reader's cache, `marker-studio-ocr-1`, and downloaded with the model if the reader hasn't brought them already).

Each version has a folder of its own. To update: add the new folder, change `SUB_VER` and the file list with its sizes
and hashes in `src/js/guide/48-subject.js`, and `SUBC` in `service-worker.js`, then remove the old folder.

## Version 4 (v329.3)

| File | Bytes | SHA-256 | What it is |
|---|---|---|---|
| `subject-te4.onnx` | 22 281 030 | `aa2f16acec6dafad9cdc9489447dc7ba4f993ba9421496ecb7b3b1779ad65a84` | TRACER-TE4 (EfficientNet-B4 backbone; Lee, Shin and Han, 2022, github.com/Karel911/TRACER) fine-tuned for Marker Studio: round 5's C1, from the kit in `tools/subject-train/` (the authors' v1.0 TE4 weights as the start; the decoder and the backbone's blocks 22–31 trained with round 3's A3 recipe on round 3's photos and labels, 9 passes, the last 3 passes' weights averaged), exported by the kit's step 6: input 1 × 3 × 448 × 448 (RGB, ImageNet's mean and spread), the output the subject map (a sigmoid, used as it is) |

The same export as version 3 (the same operators, opset 17, onnxslim, int8 weights per output channel turned back into
float32 when the model loads, the rest float16), a bigger network at a bigger input: on Ben's iPad, one thread, about
0.48 s a map against version 3's 0.14 s (the authors' TE4 weights, measured on the timing page), once per photo.
Chosen by the kit's round-5 rule, fixed before the run (decisions 88–98e), on fresh held-out photos no model had trained
on, against version 3 (A3): subjects' outline +0.036 (95% interval +0.031 to +0.040), small subjects found +4.8 points
(+2.9 to +7.0), small subjects' overlap +0.054, people's outline +0.034, false subjects on empty crops −3.1 points, every
guard held; as the exported file, the same within 0.001; on the same photos full size, as the app squashes them, the
same. Training photos: Open Images, CC BY 2.0 (photos) and CC BY 4.0 (outlines); the kit's `attribution.csv` lists each
training photo's author and licence (kept with the run's results).

Licence: TRACER, Apache License 2.0 (`LICENSE-TRACER`). Version 3's folder removed; a device that had it downloads
version 4 (a new cache, `marker-studio-subject-4`; the old one let go on update).

## Version 3 (v329.2, replaced by version 4)

| File | Bytes | SHA-256 | What it is |
|---|---|---|---|
| `subject-te0.onnx` (removed) | 8 264 777 | `dec267c6dbda0349befe383c9f8d1c1900e61bc71d54ce5e1ac99841c281fe97` | TRACER-TE0 (salient object detection: Lee, Shin and Han, 2022, github.com/Karel911/TRACER) fine-tuned for Marker Studio: round 3's A3, from the kit in `tools/subject-train/` (the authors' v1.0 weights as the start; the decoder and the backbone's blocks 11–15 trained on 35,330 Open Images photos with their hand-drawn outlines and 4,000 empty crops, 9 passes, the last 3 passes' weights averaged), exported by the kit's step 6: input 1 × 3 × 320 × 320 (RGB, ImageNet's mean and spread), the output the subject map (a sigmoid, used as it is: no stretch) |

The same graph as version 2 (the same operators, opset 17, onnxslim, the weights of 3 or more dimensions int8 per
output channel, the rest float16), so the same speed. Chosen by the kit's round-3 rule, fixed before the run, on fresh
held-out photos no model had trained on: against stock, subjects' outline +0.027, small subjects found +6.8 points,
false subjects on empty crops −9.9 points; against round 2's A2plus, small subjects found +2.1 points (95% interval
+1.1 to +3.3), outline +0.003, every guard held. Training photos: Open Images, CC BY 2.0 (photos) and CC BY 4.0
(outlines); the kit's `attribution.csv` lists each training photo's author and licence (kept with the run's results).

Licence: TRACER, Apache License 2.0 (`LICENSE-TRACER`, from github.com/Karel911/TRACER, copyright 2021 Min Seok (Karel)
Lee).

## Version 2 (v329.2 before release, replaced by version 3)

TRACER-TE0 with the authors' own weights, `4355400061f30fb81c904a4859b6983fce644a7818e4a6e859755deb428f6b89` (8 264 777 bytes), exported by
`tools/subject-train/dev/export_stock.py` from the kit's copy of TRACER's code (`tools/subject-train/tracer/`, its
changes in `NOTICE.md`: the edge step's FFT written as matrix products and its quantile as a sort, the same sums, as
ONNX Runtime Web has neither), then onnxslim, then the weights of 3 or more dimensions stored as int8 per output
channel (turned back into float32 when the model loads: the arithmetic is float32), the rest float16. The same map as
the full-precision model (at most 0.25% of the pixels on the other side of 0.5, on the subject's edges); in Chromium on
the app's ONNX Runtime Web, one thread, about 0.45 s a map against u2netp's 2.0 s. Chosen in v329.2's pressure tests
over u2netp (better on 5 of 15 bench photos, worse on 2, 4.4× quicker). Its folder removed; a device that had it
downloads version 3 (a new cache, `marker-studio-subject-3`; the old one let go on update).

## Version 1 (v325.1 – v329.1, removed)

| File | Bytes | SHA-256 | What it is |
|---|---|---|---|
| `u2netp.onnx` | 4 574 861 | `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8` | U²-Net small (`u2netp`, salient object detection: Qin et al., 2020), the ONNX export rembg publishes (`github.com/danielgatis/rembg`, release `v0.0.0`, `u2netp.onnx`), unmodified: input 1 × 3 × 320 × 320 (RGB, ImageNet's mean and spread), the first output the subject map |

Licence: U²-Net, Apache License 2.0 (`LICENSE-U2Net`, from `github.com/xuebinqin/U-2-Net`). Chosen over SAM (stray
straight lines, 100 MB, 20–25 s) in the plan's spike: `docs/PLAN-photo-to-page.md`.
