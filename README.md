# TEENet Wallet Frontend

React frontend for **TEENet Wallet** — a secure multi-chain wallet powered by TEE hardware. Maintained by [TEENet](https://teenet.io).

> Passkey-native, key-never-leaves-TEE wallet for EVM and Solana, with an approval queue for agent-driven transactions.

## Features

- Passkey (WebAuthn) authentication with email-verified registration
- Multi-chain wallet management (EVM + Solana, mainnet / testnet)
- Whitelisted contract/program registry with preset catalogue
- USD approval-threshold policies with daily spend gauge
- Approval queue for agent transactions, with countdown and risk summary
- API key management (create / rename / revoke)
- Address book with passkey-gated CRUD
- Audit history timeline
- Dark / Light theme
- English / Simplified Chinese i18n

## Tech Stack

- React 19 + TypeScript 5.8 (`strict: true`)
- Tailwind CSS v4 (CSS-first config in `src/index.css`)
- Vite 6
- ESLint 9 + Prettier 3

## Browser Support

Modern evergreen browsers with WebAuthn platform-authenticator support:

- Chrome / Edge ≥ 109
- Safari ≥ 16.4 (macOS 13+, iOS 16.4+)
- Firefox ≥ 122

This project targets **ES2022**. No legacy polyfills are shipped.

## Quick Start

```bash
# Node 20+ required (see .nvmrc)
nvm use

npm install
npm run dev        # dev server on http://127.0.0.1:3000
```

## Scripts

```bash
npm run dev          # vite dev server
npm run build        # production build -> dist/
npm run typecheck    # tsc --noEmit
npm run lint         # eslint . && tsc --noEmit
npm run format       # prettier --write .
```

Source maps are **disabled** in production builds — see `vite.config.ts`.

## Runtime Configuration

The frontend resolves its API base URL at runtime from the current page path (`src/lib/api.ts`). This lets the same bundle be mounted under any sub-path of the host (e.g. `/instance/<id>/`). No build-time `.env` variables are required.

## Deployment

This frontend is designed to be served by the [teenet-wallet](https://github.com/TEENet-io/teenet-wallet) Go backend. The backend serves `dist/` as static files and proxies API requests under the same origin.

### As a git submodule

The backend includes this repo as a submodule at `frontend-src/`. To build the Docker image with the frontend included:

```bash
cd teenet-wallet
./export.sh
```

### Standalone

```bash
npm run build
# Copy dist/ to the backend's frontend/ directory.
```

## Supported Chains

Chains are configured by the backend and fetched at runtime via `GET /api/chains`. Built-in defaults include:

- **EVM**: Ethereum, Sepolia, Holesky, Optimism, Base Sepolia, BSC Testnet
- **Solana**: Mainnet, Devnet

To add or change chains, edit `chains.json` on the backend.

## Project Layout

```
src/
├── App.tsx                  # Root router + layout
├── main.tsx                 # React entry + providers
├── contexts/                # Auth / Wallet / Theme / Language / Toast
├── components/              # Shared UI + wallet/ panels
├── pages/                   # WalletList, WalletDetail, ApprovalList, AuditHistory
├── lib/                     # api client, passkey helpers, validators
├── i18n/                    # en.ts, zh.ts
└── types/                   # Shared TS types
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Security

If you discover a security vulnerability, **do not open a public issue**. See [SECURITY.md](SECURITY.md) for the responsible-disclosure process.

## License

GPL-3.0-or-later — see [LICENSE](LICENSE).

Copyright © 2026 TEENet.
