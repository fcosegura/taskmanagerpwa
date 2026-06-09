# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Versión D1-Integration
- Multi-user support with Google OAuth
- Cloudflare D1 persistence
- Preview branch validation enabled
- Verificación local y CI: `npm run test:verify` (unit + lint + Playwright E2E). Tras `npm install`, Husky ejecuta `test:verify` en **pre-push**; si falla, Git cancela el push. Emergencia: `SKIP_HOOKS=1 git push`.
- GitHub Actions (workflow E2E) en push a `main` y en PRs. Para **bloquear el merge** si el job falla: *Settings → Branches → Branch protection rule* en `main` → *Require status checks* → marcar **Playwright E2E** (nombre del job en el workflow).
