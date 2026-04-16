# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- GPL-3.0-or-later LICENSE, SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md
- GitHub issue / PR templates and CI workflow
- `.editorconfig`, `.gitattributes`, `.nvmrc`
- ESLint + Prettier configs
- Per-file SPDX copyright headers
- Address-format validation helper for EVM and Solana (`src/lib/validators.ts`)
- Runtime sanitization of error messages surfaced to the UI
- Inline SVG favicon, theme-color and description meta tags

### Changed

- Enabled TypeScript `strict` mode (and `noUnusedLocals`, `noUnusedParameters`)
- Vite dev server binds `127.0.0.1` by default (override with `VITE_HOST`)
- Production builds no longer emit source maps
- `package.json` promoted to OSS metadata (repository, license, author, engines, browserslist)

### Removed

- Legacy `index_old.html` (156 KB)
- Dead wallet panels (`TransferPanel`, `ContractPanel`, `WhitelistPanel`, `WrapPanel`) that were never mounted
- Unused i18n keys

### Security

- `SECURITY.md` with responsible-disclosure process
- Address format validation before submitting transfers / contract whitelists
