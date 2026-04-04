#!/usr/bin/env python3
"""
Generates release notes by sending git commits to an OpenAI-compatible API.

Required env vars:
  VERSION       — the version being released (e.g. 0.3.0)
  AI_API_KEY    — API key

Optional env vars:
  AI_BASE_URL   — base URL of the API  (default: https://api.openai.com/v1)
  AI_MODEL      — model name           (default: gpt-4o-mini)
"""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

VERSION     = os.environ.get("VERSION", "")
API_KEY     = os.environ.get("AI_API_KEY", "")
BASE_URL    = os.environ.get("AI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
MODEL       = os.environ.get("AI_MODEL", "gpt-4o-mini")

if not VERSION:
    print("ERROR: VERSION env var not set", file=sys.stderr)
    sys.exit(1)

if not API_KEY:
    print("ERROR: AI_API_KEY env var not set", file=sys.stderr)
    sys.exit(1)

# ── Collect commits since last tag ────────────────────────────────────────────

prev_tag = subprocess.run(
    ["git", "describe", "--tags", "--abbrev=0", "HEAD"],
    capture_output=True, text=True, encoding="utf-8"
).stdout.strip()

if prev_tag:
    print(f"Since tag: {prev_tag}", file=sys.stderr)
    git_log = subprocess.run(
        ["git", "log", "--pretty=format:- %s (%h)", f"{prev_tag}..HEAD"],
        capture_output=True, text=True, encoding="utf-8"
    ).stdout.strip()
else:
    print("No previous tag found, using last 30 commits", file=sys.stderr)
    git_log = subprocess.run(
        ["git", "log", "--pretty=format:- %s (%h)", "--max-count=30"],
        capture_output=True, text=True, encoding="utf-8"
    ).stdout.strip()

if not git_log:
    git_log = "- Initial release"

print(f"Commits:\n{git_log}\n", file=sys.stderr)

# ── Call API (OpenAI-compatible format) ───────────────────────────────────────

prompt = f"""You are writing release notes for MediaForge v{VERSION}.

MediaForge is a cross-platform desktop app for AI-powered media processing (background removal, image resizing/stitching/conversion, video frame extraction and GIF export). Built with Tauri + React + Python.

Based on the following git commits, write concise and user-friendly **English** release notes in GitHub Markdown.

Rules:
- Use sections: ## ✨ New Features, ## 🔧 Improvements, ## 🐛 Bug Fixes  (omit empty sections)
- Each item is a single bullet point focused on what changed for the user, not implementation details
- Skip internal/chore/docs commits (e.g. version bumps, CI changes) unless significant
- Keep each bullet to one sentence

Commits:
{git_log}"""

payload = json.dumps({
    "model": MODEL,
    "max_completion_tokens": 1024,
    "messages": [{"role": "user", "content": prompt}],
}).encode("utf-8")

url = f"{BASE_URL}/chat/completions"
print(f"Calling {url} with model {MODEL}", file=sys.stderr)

req = urllib.request.Request(
    url,
    data=payload,
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
)

try:
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"API error {e.code}: {body}", file=sys.stderr)
    sys.exit(1)

notes = result["choices"][0]["message"]["content"].strip()
print(f"Generated notes:\n{notes}", file=sys.stderr)

# ── Write to GITHUB_OUTPUT ─────────────────────────────────────────────────────

github_output = os.environ.get("GITHUB_OUTPUT", "")
if github_output:
    with open(github_output, "a", encoding="utf-8") as f:
        f.write("notes<<EOF\n")
        f.write(notes + "\n")
        f.write("EOF\n")
    print("Written to GITHUB_OUTPUT", file=sys.stderr)
else:
    print(notes)
