# MediaForge

A modern, cross-platform media processing toolkit built with Tauri 2.0 + React + Python.

![MediaForge](https://img.shields.io/badge/version-0.1.0-blue)
![Tauri](https://img.shields.io/badge/Tauri-2.0-orange)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### 🎨 Background Remover
- **AI-Powered**: Remove backgrounds using neural networks (U2Net, ISNet, Silueta, RMBG-2.0)
- **Chroma Key**: Remove solid color backgrounds with adjustable tolerance
- **Batch Processing**: Process multiple images at once with a shared output folder

### 🖼️ Image Resizer
- Multiple resize modes: Scale, Fixed Size, Fixed Width, Fixed Height
- Batch processing support
- High-quality Lanczos resampling

### 🖼️ Image Stitcher
- Combine multiple images into a grid layout
- Configurable columns and spacing

### 🔄 Format Converter
- Convert images between PNG, JPEG, WebP, BMP
- Quality control, batch processing

### 🎬 Video Processing
- **Frame Extraction**: Extract all frames or at intervals
- **Video to GIF**: Convert videos to animated GIFs with FPS and scale control

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + TailwindCSS v4 |
| Desktop | Tauri 2.0 (Rust) |
| AI Backend | Python (ONNX Runtime, direct inference) |
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
│   │   ├── layout/        # Sidebar, Header, Settings, ThemeToggle
│   │   ├── tools/         # BackgroundRemover, ImageResizer, etc.
│   │   └── ui/            # ImagePreview, ResultActions
│   ├── hooks/             # usePython, useTheme, useFileDrop
│   └── lib/               # python-rpc, i18n, utils
├── src-tauri/             # Rust backend
│   └── src/
│       ├── lib.rs         # Tauri commands
│       └── python/        # Python process manager
├── python_backend/        # Python AI backend
│   ├── core/              # Processing logic
│   ├── utils/             # Portable mode helpers
│   └── server.py          # NDJSON RPC server
├── models/                # AI models (user-downloaded)
└── .github/
    ├── workflows/
    │   └── release.yml    # CI/CD release workflow
    └── scripts/
        ├── bump-version.js
        └── gen-notes.py
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

## CI/CD

Releases are published via GitHub Actions (`release.yml`). No manual tag pushing required.

**Trigger:** GitHub → Actions → Release → Run workflow → enter version (e.g. `0.3.0`)

The workflow automatically:
1. Bumps version in `package.json`, `tauri.conf.json`, `Cargo.toml`
2. Generates release notes from git commits using an AI model (OpenAI-compatible API)
3. Commits, tags, and pushes to `main`
4. Builds signed Windows installer + `latest.json` (for in-app auto-update)
5. Creates a draft GitHub Release for review before publishing

**Required GitHub Secrets:**

| Secret | Description |
|--------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri updater signing key (generate with `npx tauri signer generate`) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password (leave empty if none) |
| `AI_API_KEY` | API key for release notes generation |
| `AI_BASE_URL` | *(optional)* Custom base URL — defaults to OpenAI, supports any OpenAI-compatible endpoint |
| `AI_MODEL` | *(optional)* Model name — defaults to `gpt-4o-mini` |

## License

MIT License

### Open Source Components
- [ONNX Runtime](https://onnxruntime.ai/) - AI model inference (U2Net, ISNet, Silueta, RMBG-2.0)
- [OpenCV](https://opencv.org/) - Video processing
- [Pillow](https://python-pillow.org/) - Image manipulation
