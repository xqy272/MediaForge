# MediaForge

A modern, cross-platform media processing toolkit built with Tauri 2.0 + React + Python.

![MediaForge](https://img.shields.io/badge/version-0.1.0-blue)
![Tauri](https://img.shields.io/badge/Tauri-2.0-orange)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### 🎨 Background Remover
- **AI-Powered**: Remove backgrounds using neural networks (U2Net, ISNet, Silueta)
- **Chroma Key**: Remove solid color backgrounds with adjustable tolerance
- **Alpha Matting**: Smooth edge processing for better quality

### 🖼️ Image Resizer
- Multiple resize modes: Scale, Fixed Size, Fixed Width, Fixed Height
- Batch processing support
- High-quality Lanczos resampling

### 🎬 Video Processing
- **Frame Extraction**: Extract all frames or at intervals
- **Video to GIF**: Convert videos to animated GIFs with FPS and scale control

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + TailwindCSS v4 |
| Desktop | Tauri 2.0 (Rust) |
| AI Backend | Python (rembg, ONNX Runtime) |
| Video | OpenCV, Pillow |

## Development

### Prerequisites
- Node.js 18+
- Rust 1.70+
- Python 3.10+

### Setup

```bash
# Install frontend dependencies
npm install

# Install Python dependencies
cd python_backend
pip install -r requirements.txt
cd ..

# Run in development mode
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

## Project Structure

```
MediaForge/
├── src/                    # React frontend
│   ├── components/
│   │   ├── layout/        # Sidebar, Header, ThemeToggle
│   │   └── tools/         # BackgroundRemover, ImageResizer, etc.
│   ├── hooks/             # usePython, useTheme
│   └── lib/               # python-rpc, i18n, utils
├── src-tauri/             # Rust backend
│   └── src/
│       ├── lib.rs         # Tauri commands
│       └── python/        # Python process manager
├── python_backend/        # Python AI backend
│   ├── core/              # Processing logic
│   ├── utils/             # Portable mode helpers
│   └── server.py          # NDJSON RPC server
└── models/                # AI models (user-downloaded)
```

## Portable Mode

MediaForge supports fully portable operation:
- Models stored in `./models/`
- Config stored in `./config/`
- No files written to user directories

## Localization

Supported languages:
- English
- 简体中文 (Simplified Chinese)
- 日本語 (Japanese)

## License

MIT License

### Open Source Components
- [FFmpeg](https://ffmpeg.org/) - Used for video processing (GPL)
- [rembg](https://github.com/danielgatis/rembg) - Background removal
- [ONNX Runtime](https://onnxruntime.ai/) - AI model inference
