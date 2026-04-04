# MediaForge - Development Guide

## Project Overview

MediaForge is a modern, cross-platform media processing toolkit built with **Tauri 2.0 + React + Python**. It provides AI-powered image and video processing tools with a clean, responsive UI.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                          │
│  (TypeScript + TailwindCSS v4 + Framer Motion)             │
├─────────────────────────────────────────────────────────────┤
│                    Tauri 2.0 (Rust)                         │
│  Commands: init_python, python_call, python_status          │
├─────────────────────────────────────────────────────────────┤
│               Python Backend (subprocess)                   │
│  NDJSON JSON-RPC over stdin/stdout                         │
│  (ONNX Runtime, OpenCV, Pillow, NumPy)                     │
└─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 19 + TypeScript | UI components, state management |
| Desktop Shell | Tauri 2.0 (Rust) | Native window, IPC, process management |
| AI Backend | Python 3.10+ | Image/video processing, ML inference |

## Project Structure

```
MediaForge/
├── src/                        # React frontend
│   ├── components/
│   │   ├── layout/            # Sidebar, Header, ThemeToggle
│   │   ├── tools/             # BackgroundRemover, ImageResizer, etc.
│   │   └── ui/                # Shared UI components
│   ├── hooks/                 # usePython, useTheme
│   ├── lib/                   # python-rpc, i18n, utils
│   └── locales/               # i18n translations (en, zh, ja)
├── src-tauri/                 # Rust backend
│   └── src/
│       ├── lib.rs             # Tauri commands
│       └── python/
│           ├── manager.rs     # Python process lifecycle
│           └── ipc.rs         # JSON-RPC message types
├── python_backend/            # Python AI backend
│   ├── core/                  # Processing modules
│   │   ├── background_remover.py
│   │   ├── image_resizer.py
│   │   └── video_processor.py
│   ├── utils/                 # Portable mode, model management
│   ├── server.py              # NDJSON RPC server
│   ├── rpc_handlers.py        # RPC method implementations
│   └── requirements.txt       # Python dependencies
└── models/                    # AI models (user-downloaded)
```

## Key Technologies

### Frontend
- **React 19** with TypeScript
- **TailwindCSS v4** for styling
- **Framer Motion** for animations
- **i18next** for internationalization
- **Lucide React** for icons

### Desktop
- **Tauri 2.0** with async commands
- **tauri-plugin-dialog** for file dialogs
- **tauri-plugin-opener** for shell integration

### Python Backend
- **ONNX Runtime** - Direct AI model inference (U2Net, ISNet, Silueta, RMBG-2.0); rembg no longer used
- **OpenCV** - Video processing
- **Pillow** - Image manipulation
- **ONNX Runtime** - ML inference (CPU/GPU)

## IPC Protocol

Communication between Tauri and Python uses **NDJSON JSON-RPC 2.0** over stdin/stdout:

### Request Format
```json
{"jsonrpc": "2.0", "id": "uuid", "method": "remove_background", "params": {...}}
```

### Response Format
```json
{"jsonrpc": "2.0", "id": "uuid", "result": {...}}
```

### Notifications (Python → Tauri)
```json
{"jsonrpc": "2.0", "method": "progress", "params": {"task_id": "...", "progress": 0.5}}
```

## Available RPC Methods

| Method | Description |
|--------|-------------|
| `ping` | Health check |
| `remove_background` | AI background removal |
| `remove_background_batch` | Batch background removal |
| `chroma_key` | Color-based background removal |
| `resize_image` | Image resizing |
| `extract_frames` | Video frame extraction |
| `video_to_gif` | Video to GIF conversion |
| `stitch_images` | Image grid stitching |
| `convert_image` | Format conversion |
| `check_model` | Check model availability |
| `list_models` | List available models |

## Development Commands

```bash
# Install dependencies
npm install
cd python_backend && pip install -r requirements.txt

# Development mode
npm run tauri dev

# Build production
npm run tauri build

# Frontend only (for UI development)
npm run dev
```

## Build Targets

- **Windows**: MSI installer, NSIS installer
- **macOS**: DMG, App bundle (planned)
- **Linux**: AppImage, deb (planned)

## Portable Mode

MediaForge supports fully portable operation:
- Models stored in `./models/`
- Config stored in `./config/`
- No files written to user directories

## Code Conventions

### TypeScript/React
- Functional components with hooks
- Props interfaces defined inline or in same file
- Use `usePython` hook for backend calls

### Rust
- Async Tauri commands with `#[tauri::command]`
- Error handling via `Result<T, String>`
- Thread-safe state with `Arc<Mutex<T>>`

### Python
- Type hints for all function parameters
- Docstrings for public functions
- Use `@register_method` decorator for RPC handlers

## Localization

Supported languages:
- English (`en`)
- Simplified Chinese (`zh`)
- Japanese (`ja`)

Translation files: `src/locales/{lang}/translation.json`

## GPU Support

| GPU | Package |
|-----|---------|
| NVIDIA | `onnxruntime-gpu` |
| AMD/Intel (Windows) | `onnxruntime-directml` |
| CPU fallback | `onnxruntime` |
