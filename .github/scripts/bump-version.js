#!/usr/bin/env node
// Updates version in package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml
// Usage: node bump-version.js <version>

import { readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error('Usage: node bump-version.js <version>  (e.g. 0.3.0)');
  process.exit(1);
}

const root = resolve(__dirname, '../..');

// package.json
const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`package.json        → ${version}`);

// src-tauri/tauri.conf.json
const tauriConfPath = join(root, 'src-tauri/tauri.conf.json');
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = version;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log(`tauri.conf.json     → ${version}`);

// src-tauri/Cargo.toml — replace only the [package] section version (first semver match)
const cargoPath = join(root, 'src-tauri/Cargo.toml');
let cargo = readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(/^(version\s*=\s*)"(\d+\.\d+\.\d+[^"]*)"/m, `$1"${version}"`);
writeFileSync(cargoPath, cargo);
console.log(`Cargo.toml          → ${version}`);
