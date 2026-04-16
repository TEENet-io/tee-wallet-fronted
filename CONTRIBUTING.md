# Contributing to TEENet Wallet Frontend

Thanks for considering a contribution! This project is maintained by [TEENet](https://teenet.io) and released under the GNU General Public License v3.0 or later.

By submitting a patch, you agree that your contribution is licensed under the same terms.

## Ground Rules

- **Security first.** This is a wallet frontend. Any change that touches authentication, signing, approvals, or address parsing will be reviewed carefully. Prefer small, focused PRs for such changes.
- **No secrets in commits.** Run `git diff --cached` before every commit. If you accidentally commit a secret, rotate it immediately and rewrite history before pushing.
- **Don't break the passkey flow on older browsers** without discussion — several users rely on cross-platform roaming authenticators.
- **Respect TypeScript `strict: true`.** Do not silence errors with `any`, `as unknown as X`, `@ts-ignore`, or `@ts-expect-error` without a comment explaining why.

## Development

```bash
nvm use              # or: node --version should be >= 20
npm install
npm run dev          # dev server on http://127.0.0.1:3000
npm run typecheck    # tsc --noEmit (must pass before PR)
npm run lint         # eslint + tsc
```

## Pull Request Checklist

Before opening a PR, please confirm:

- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] No new `any`, `@ts-ignore`, or `as unknown as ...` introduced
- [ ] New user-facing strings are added to **both** `src/i18n/en.ts` and `src/i18n/zh.ts`
- [ ] New icon-only buttons have `aria-label`
- [ ] New `useEffect` that fetches has an `AbortController` cleanup
- [ ] No `console.log` left behind
- [ ] Commit messages follow `type: imperative summary` (e.g. `fix: validate EVM address before submit`)

## Coding Style

- TypeScript strict mode, no `any`
- 2-space indentation
- Single quotes for strings
- Trailing commas in multi-line objects / arrays
- Tailwind utility classes for styling; shared styles live in `src/index.css`

## i18n

Every user-visible string must go through `t('key.name')`. Keys must exist in both `en.ts` and `zh.ts`. Do not use `t(key) || 'fallback'` — missing keys should be caught in review, not masked.

## Reporting Bugs

Use the bug-report issue template. For security vulnerabilities, **do not** open a public issue — see [SECURITY.md](SECURITY.md).

## Code of Conduct

By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).
