# Subject finder (vendored)

What a photo-made colouring page's **Focus: Sharper subject** (and **Simpler background**) runs, on the device: U²-Net's
small model, which says how much each part of a photo is its subject. The app's code that uses it is in
`src/js/guide/48-subject.js`. Downloaded only when someone chooses one of those, after a consent card, into a cache of
its own (`marker-studio-subject-<version>`), which an app update leaves alone; the service worker never stores it in the
app's cache. It runs on ONNX Runtime Web, the photo reader's own copy (`vendor/ocr/1/`: its two `ort` files, kept in
the reader's cache, `marker-studio-ocr-1`, and downloaded with the model if the reader hasn't brought them already).

Each version has a folder of its own. To update: add the new folder, change `SUB_VER` and the file list with its sizes
and hashes in `src/js/guide/48-subject.js`, and `SUBC` in `service-worker.js`, then remove the old folder.

## Version 1

| File | Bytes | SHA-256 | What it is |
|---|---|---|---|
| `u2netp.onnx` | 4 574 861 | `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8` | U²-Net small (`u2netp`, salient object detection: Qin et al., 2020), the ONNX export rembg publishes (`github.com/danielgatis/rembg`, release `v0.0.0`, `u2netp.onnx`), unmodified: input 1 × 3 × 320 × 320 (RGB, ImageNet's mean and spread), the first output the subject map |

Licence: U²-Net, Apache License 2.0 (`LICENSE-U2Net`, from `github.com/xuebinqin/U-2-Net`). Chosen over SAM (stray
straight lines, 100 MB, 20–25 s) in the plan's spike: `docs/PLAN-photo-to-page.md`.
