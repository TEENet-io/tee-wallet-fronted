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

  
## Deployment

This frontend is designed to be served by the [teenet-wallet](https://github.com/TEENet-io/teenet-wallet) Go backend. The backend serves `dist/` as static files and proxies API requests under the same origin.


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
