# Security Policy

TEENet Wallet is a cryptocurrency wallet frontend. Vulnerabilities — especially those that could lead to fund loss, key disclosure, unauthorized approvals, or bypass of the passkey gate — are treated with the highest priority.

## Reporting a Vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

Instead, report privately via one of:

1. **GitHub Security Advisory** — use the "Report a vulnerability" button at <https://github.com/TEENet-io/teenet-wallet-frontend/security/advisories/new>.
2. **Email** — `security@teenet.io` with subject line `[TEENet Wallet Frontend] <short description>`.

When reporting, please include:

- A description of the issue and the potential impact
- Steps to reproduce (or a proof of concept)
- The affected version, commit hash, or build
- Your name / handle for credit (optional)

## Our Commitment

- We will acknowledge your report within **72 hours**.
- We will provide an initial assessment within **7 days**.
- We will keep you informed of progress throughout the triage, fix, and disclosure process.
- We will credit you in the release notes unless you prefer to remain anonymous.

## Scope

In scope:

- This repository (`teenet-wallet-frontend`)
- The passkey / WebAuthn authentication flow
- The approval-queue UI
- Any client-side cryptography or data-validation path

Out of scope (report to the respective project):

- Backend: <https://github.com/TEENet-io/teenet-wallet>
- TEE key-management SDK: <https://github.com/TEENet-io/tee-dao-key-management-sdk>

## Supported Versions

Security fixes are applied to the `main` branch and the latest tagged release. Older tags do not receive backports.

## Safe Harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, destruction of data, or service disruption
- Do not access user data beyond what is necessary to demonstrate the vulnerability
- Give us reasonable time to respond before public disclosure
