#!/usr/bin/env node
// Updates version in package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml
// Usage: node bump-version.js <version>

const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error('Usage: node bump-version.js <version>  (e.g. 0.3.0)');
  process.exit(1);
}

const root = path.resolve(__dirname, '../..');

// package.json
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`package.json        → ${version}`);

// src-tauri/tauri.conf.json
const tauriConfPath = path.join(root, 'src-tauri/tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = version;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log(`tauri.conf.json     → ${version}`);

// src-tauri/Cargo.toml — replace only the [package] section version (first semver match)
const cargoPath = path.join(root, 'src-tauri/Cargo.toml');
let cargo = fs.readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(/^(version\s*=\s*)"(\d+\.\d+\.\d+[^"]*)"/m, `$1"${version}"`);
fs.writeFileSync(cargoPath, cargo);
console.log(`Cargo.toml          → ${version}`);
