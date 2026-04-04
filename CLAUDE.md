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
│   │   ├── layout/            # Sidebar, Header, ThemeToggle, LanguageSelector
│   │   ├── tools/             # BackgroundRemover, ImageResizer, etc.
│   │   └── ui/                # Shared UI components (ImagePreview, ResultActions)
│   ├── hooks/                 # usePython, useTheme
│   ├── lib/                   # python-rpc, i18n, utils
│   └── locales/               # i18n translations (en, zh-CN, ja)
├── src-tauri/                 # Rust backend
│   └── src/
│       ├── lib.rs             # Tauri commands + data directory resolution
│       ├── main.rs            # Entry point
│       └── python/
│           ├── mod.rs         # Module root
│           ├── manager.rs     # Python process lifecycle
│           └── ipc.rs         # JSON-RPC message types
├── python_backend/            # Python AI backend
│   ├── core/                  # Processing modules
│   │   ├── background_remover.py  # AI + Chroma key background removal
│   │   ├── image_resizer.py       # Multi-mode image resizing
│   │   └── video_processor.py     # Frame extraction + GIF conversion
│   ├── utils/                 # Portable mode, model management, GPU
│   │   ├── portable.py        # Data dir, model paths, model URLs
│   │   └── gpu_manager.py     # ONNX Runtime provider detection
│   ├── server.py              # NDJSON RPC server (ThreadPoolExecutor)
│   ├── rpc_handlers.py        # RPC method implementations
│   ├── watchdog.py            # Parent process monitor
│   ├── main.py                # Entry point (stdin/stdout guards)
│   └── requirements.txt       # Python dependencies
└── models/                    # AI models (user-downloaded, .onnx files)
```

## Key Technologies

### Frontend
- **React 19** with TypeScript (lazy-loaded tool components via `React.lazy`)
- **TailwindCSS v4** for styling (CSS-first config via `@theme`)
- **Framer Motion** for animations
- **i18next** for internationalization (en, zh-CN, ja)
- **Lucide React** for icons

### Desktop
- **Tauri 2.0** with async commands
- **tauri-plugin-dialog** for file dialogs
- **tauri-plugin-opener** for shell integration (`openPath`, `revealItemInDir`)

### Python Backend
- **ONNX Runtime** - Direct AI model inference (U2Net, ISNet, Silueta, RMBG-2.0)
- **OpenCV** (headless) - Video processing with Unicode path workaround
- **Pillow** - Image manipulation
- **NumPy** - Array processing for ONNX inference

## UI Components

### Shared UI (`src/components/ui/`)
- **ImagePreview** - Displays image thumbnails via Tauri's `convertFileSrc` asset protocol
- **ResultActions** - Post-processing actions: Open File, Show in Folder, Copy Path

### Layout (`src/components/layout/`)
- **MainLayout** - Dual-column layout with collapsible sidebar
- **Sidebar** - Tool navigation (collapsible), GPU status indicator, GitHub link
- **Header** - Tool title/description, language selector, theme toggle
- **ThemeToggle** - Light/Dark/System theme switcher
- **LanguageSelector** - Language dropdown (en, zh-CN, ja)

### Tool Components (`src/components/tools/`)
All tools include: image preview, progress bar, result actions (open/reveal/copy), unmount cleanup for event listeners.

| Tool | Features |
|------|----------|
| BackgroundRemover | AI mode (6 models) + Chroma key, batch processing |
| ImageResizer | 4 resize modes: scale, fixed, fixed-width, fixed-height |
| ImageStitcher | Grid layout with configurable columns and spacing |
| FormatConverter | PNG/JPEG/WebP/BMP, quality control, batch |
| VideoToFrames | All frames or interval extraction |
| VideoToGif | Configurable FPS and scale |

## IPC Protocol

Communication between Tauri and Python uses **NDJSON JSON-RPC 2.0** over stdin/stdout:

### Request Format
```json
{"jsonrpc": "2.0", "id": "uuid", "method": "bg.remove", "params": {...}}
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
| `shutdown` | Graceful shutdown |
| `get_version` | Server version info |
| `models.check` | Check model availability |
| `models.list` | List available models |
| `models.get_dir` | Get models directory path |
| `bg.remove` | AI background removal (single) |
| `bg.remove_batch` | AI background removal (batch) |
| `bg.chroma_key` | Color-based background removal |
| `image.resize` | Image resizing |
| `image.info` | Get image dimensions/format |
| `image.stitch` | Image grid stitching |
| `image.convert` | Single image format conversion |
| `image.convert_batch` | Batch format conversion |
| `image.rotate` | Image rotation (backend-only, no UI yet) |
| `image.rename_batch` | Batch file rename (backend-only, no UI yet) |
| `video.info` | Get video metadata |
| `video.extract_frames` | Video frame extraction |
| `video.to_gif` | Video to GIF conversion |
| `gpu.info` | GPU acceleration info |

## Development Commands

```bash
# Install dependencies
npm install
cd python_backend && pip install -r requirements.txt

# Development mode (recommended)
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
- Models stored in `./models/` (or `LOCALAPPDATA/MediaForge/models/` if exe dir is not writable)
- Config stored in `./config/`
- Data directory resolved via `MEDIAFORGE_DATA_DIR` env, writability check, or LOCALAPPDATA fallback
- Both Rust (`resolve_data_dir()`) and Python (`get_data_dir()`) use the same resolution logic

## Code Conventions

### TypeScript/React
- Functional components with hooks
- Props interfaces defined inline or in same file
- Use `usePython` hook for backend lifecycle
- Use `pythonCall<T>()` from `python-rpc.ts` for backend calls
- Tool components use `React.lazy` for code splitting
- All user-facing strings go through `react-i18next` (`t('key')`) — no hardcoded text
- Event listeners (`onProgress`) must be cleaned up on unmount via `useRef` + `useEffect`
- Use shared UI components (`ImagePreview`, `ResultActions`) for consistent UX

### Rust
- Async Tauri commands with `#[tauri::command]`
- Error handling via `Result<T, String>`
- Thread-safe state with `Arc<Mutex<T>>`
- Python process managed via `PythonManager` (spawns child process with stdin/stdout pipes)

### Python
- Type hints for all function parameters
- Docstrings for public functions
- Use `@register_method("namespace.method")` decorator for RPC handlers
- All file paths validated via `_validate_path()` / `_validate_dir()` before use
- Logging to stderr only (stdout reserved for NDJSON RPC protocol)
- Stdout protected by `_StdoutGuard` to block accidental `print()` from libraries

## Localization

Supported languages:
- English (`en`)
- Simplified Chinese (`zh-CN`)
- Japanese (`ja`)

Translation files: `src/locales/{lang}.json` (flat JSON, no sub-directory)

All UI strings must use i18n keys. Check all 3 locale files when adding new keys.

## GPU Support

| GPU | Package |
|-----|---------|
| NVIDIA | `onnxruntime-gpu` |
| AMD/Intel (Windows) | `onnxruntime-directml` |
| CPU fallback | `onnxruntime` |

GPU status is detected at startup via `GpuManager` and displayed in the sidebar footer.

## Security

- CSP configured in `tauri.conf.json`:
  - `img-src` includes `asset:` and `https://asset.localhost` for local image preview
  - `style-src` requires `'unsafe-inline'` for TailwindCSS/Framer Motion runtime styles
- All Python RPC handlers validate paths via `_validate_path()` / `_validate_dir()` to prevent path traversal
- Null byte injection blocked in all path validation
- Python stdout is guarded to prevent JSON-RPC protocol corruption
- Windows Job Objects used to ensure Python process terminates with parent (via ` watchdog.py`)

## Known Limitations / Future Work

- **No drag-and-drop**: File selection uses Tauri native dialogs; actual drag-and-drop is not implemented
- **No model auto-download**: Users must manually download `.onnx` model files and place them in the models directory
- **No task cancellation**: Once processing starts, it cannot be canceled from the UI
- **No auto-update**: Tauri updater plugin not yet integrated
- **`image.rotate` and `image.rename_batch` RPC methods** exist in backend but have no frontend UI
- **macOS/Linux** support is planned but untested
- **No automated tests**: No pytest, Vitest, or Rust `#[cfg(test)]` coverage yet
