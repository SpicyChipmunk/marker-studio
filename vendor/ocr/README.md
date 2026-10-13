# Photo reader (vendored)

What Scan's **Read a photo of your caps** runs, on the device: ONNX Runtime Web and three PaddleOCR models. The app's own
code that uses them (the engine and its worker) is in `src/js/ocr/`. Downloaded only when someone asks for the reader,
after a consent card, into a cache of its own (`marker-studio-ocr-<version>`), which an app update leaves alone; the
service worker never stores these files in the app's cache.

Each version has a folder of its own. To update: add the new folder, change `OCR_VER` and the file list with its sizes
and hashes in `src/js/photo-read.js`, and `OCR_VER` in `service-worker.js`, then remove the old folder.

## Version 1

| File | Bytes | SHA-256 | What it is |
|---|---|---|---|
| `ort.wasm.bundle.min.mjs` | 73 054 | `11e64bd8ffe11bd1a2a2f0d6275fdfbbba7262f0b76b99b53d228a8a22ef3d90` | ONNX Runtime Web 1.30.0 (npm `onnxruntime-web`, `dist/`), unmodified: the wasm backend's JavaScript |
| `ort-wasm-simd-threaded.wasm` | 14 239 897 | `3398c10d07d229bd91b364548e130e0e51a8e5704b88c7c083ebbeb78842dee2` | its WebAssembly, unmodified (run with one thread: GitHub Pages can't isolate the page) |
| `det.onnx` | 2 423 224 | `aef1ed818b33a3bafacf9ca085ff52407f7903c5da4e65a3eef47cd23a3b46ea` | PaddleOCR `en_PP-OCRv3_det_infer` (text detection), from npm `paddle-ocr-onnx-models` 0.2.0 (a redistribution of RapidOCR's ONNX exports), with weights smaller than 1e-15 set to zero (subnormal numbers slow x86 down; the outputs are unchanged) |
| `rec.onnx` | 4 462 639 | `9ef676d6ed3c88256a2d92c640c44f25b0c40947e111b14b8be8f594091563e6` | PaddleOCR `PP-OCRv6_tiny_rec` (text recognition), unmodified, from PyPI `onnxocr` 4.0.0 (`onnxocr/models/ppocrv6/tiny/rec/rec.onnx`) |
| `rec-dict.txt` | 34 060 | `2af150bab777d86fa1ce821f6a37eabea90f1bb99ab9c41f031262e892a747bc` | its character list (`ppocrv6_tiny_dict.txt`), unmodified |
| `cls.onnx` | 578 966 | `491843a3c65de46295864c6815e41127eaa812c4dac1e19c6850ec49da9d3640` | PaddleOCR `ch_ppocr_mobile_v2.0_cls` (which way up a line of text is), from npm `@gutenye/ocr-models` 1.4.2 |

Licences: ONNX Runtime, MIT (`LICENSE-onnxruntime`); the PaddleOCR models, Apache License 2.0
(`LICENSE-PaddleOCR-models`). Upstream for the recognition model: PaddleOCR's official
`PP-OCRv6_tiny_rec_onnx_infer` export; its hash is still to be checked against Baidu's own download.
