# TWallet Frontend

React frontend for TWallet — a secure multi-chain wallet powered by TEE hardware. Maintained by TEENet.

## Tech Stack

- React 19 + TypeScript
- Tailwind CSS v4
- Vite

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build    # outputs to dist/
npm run lint     # TypeScript type check
```

## Deployment

This frontend is designed to be served by the [teenet-wallet](https://github.com/TEENet-io/teenet-wallet) Go backend. The backend serves `dist/` as static files and proxies API requests.

### As Git Submodule

The backend includes this repo as a submodule at `frontend-src/`. To build the Docker image with frontend included:

```bash
cd teenet-wallet
./export.sh
```

### Standalone

```bash
npm run build
# Copy dist/ to the backend's frontend/ directory
```

## Features

- Passkey (WebAuthn) authentication
- Multi-chain wallet management (EVM + Solana)
- Contract whitelist with preset programs
- USD approval threshold policies
- Approval queue for agent transactions
- API key management with labels
- Custom chain management
- Audit history timeline
- Dark / Light theme
- English / Chinese i18n

## License

MIT
