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
- **tauri-plugin-updater** for auto-update (checks GitHub releases)
- **tauri-plugin-process** for app relaunch after update

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
- **Sidebar** - Tool navigation (collapsible), GPU status indicator, Settings button, GitHub link
- **Header** - Tool title/description, language selector, theme toggle
- **ThemeToggle** - Light/Dark/System theme switcher
- **LanguageSelector** - Language dropdown (en, zh-CN, ja)
- **Settings** - Global settings page: appearance, model management, auto-update, about

### Tool Components (`src/components/tools/`)
All tools include: image preview, progress bar, result actions (open/reveal/copy), unmount cleanup for event listeners, **drag-and-drop file upload**, **task cancellation**.

| Tool | Features |
|------|----------|
| BackgroundRemover | AI mode (6 models) + Chroma key, batch processing, drag-drop, cancel |
| ImageResizer | 4 resize modes: scale, fixed, fixed-width, fixed-height, drag-drop |
| ImageStitcher | Grid layout with configurable columns and spacing, drag-drop, cancel |
| FormatConverter | PNG/JPEG/WebP/BMP, quality control, batch, drag-drop, cancel |
| VideoToFrames | All frames or interval extraction, drag-drop, cancel |
| VideoToGif | Configurable FPS and scale, drag-drop, cancel |

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
| `models.download` | Download AI model from remote URL |
| `task.cancel` | Cancel a running task by task_id |
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

# Build via PowerShell script (handles all steps)
./build.ps1

# Frontend only (for UI development)
npm run dev
```

## CI/CD

GitHub Actions workflow at `.github/workflows/release.yml`:
- Triggered via `workflow_dispatch` (enter version in GitHub UI — no manual tag push needed)
- Bumps version in `package.json`, `tauri.conf.json`, `Cargo.toml` via `.github/scripts/bump-version.js`
- Generates release notes from git commits via `.github/scripts/gen-notes.py` (OpenAI-compatible API)
- Commits, tags, and pushes, then builds signed Windows installer + `latest.json`
- Creates draft GitHub release with AI-generated notes
- Required secrets: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `AI_API_KEY`
- Optional secrets: `AI_BASE_URL` (default: OpenAI), `AI_MODEL` (default: `gpt-4o-mini`)

To generate a signing key pair:
```bash
npx tauri signer generate -w ~/.tauri/mediaforge.key
```
Set the public key in `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`.

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
- Use `useFileDrop` hook for native drag-and-drop file support
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

## Drag and Drop

All tool components support native drag-and-drop file upload via Tauri's `onDragDropEvent` API:
- `useFileDrop` hook (`src/hooks/useFileDrop.ts`) wraps the window-level drag event
- Accepts file extension filter and `onDrop` callback
- Returns `isDragging` state for visual feedback
- Drop zone highlights when files are dragged over the window

## Task Cancellation

- Frontend generates a `task_id` via `crypto.randomUUID()` and passes it in RPC params
- Python backend tracks cancelled tasks in `server._cancelled_tasks` set
- Long-running loops check `server.is_cancelled(task_id)` between iterations
- Frontend calls `cancelTask(taskId)` → `task.cancel` RPC to request cancellation
- Cancel button shown during processing in all tool components

## Auto-Update

- Uses `@tauri-apps/plugin-updater` to check GitHub releases for new versions
- Update endpoint configured in `src-tauri/tauri.conf.json` → `plugins.updater.endpoints`
- Settings page provides "Check for Updates" and "Install Update" buttons
- After update download, `@tauri-apps/plugin-process` relaunches the app
- CI/CD generates `latest.json` manifest alongside installer artifacts

## Known Limitations / Future Work

- **`image.rotate` and `image.rename_batch` RPC methods** exist in backend but have no frontend UI
- **macOS/Linux** support is planned but untested
- **No automated tests**: No pytest, Vitest, or Rust `#[cfg(test)]` coverage yet
- **Updater signing key** must be generated and configured before auto-update works in production
