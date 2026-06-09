# taskmanagerpwa Monorepo

Monorepo con dos aplicaciones React/Vite independientes:

- `apps/taskmanager`: gestor de tareas, Cloudflare Worker, D1 y endpoints de integracion con myNotebook.
- `apps/mynotebook`: libreta local/PWA con Dexie/IndexedDB y despliegue como Cloudflare Workers Assets.

## Scripts

```sh
npm run dev:taskmanager
npm run dev:mynotebook
npm run dev:worker
npm run lint
npm run test
npm run build
```

## Deploy

```sh
npm run deploy:taskmanager
npm run deploy:mynotebook
```

Las bases de datos no se mezclan: taskmanager mantiene su D1 `task-manager-db` y myNotebook mantiene su almacenamiento local IndexedDB.

## Cloudflare Workers Builds

Configurar dos Workers/Builds separados apuntando al mismo repositorio. Opcion recomendada:
mantener la raiz del monorepo como root directory para que Cloudflare use el `package-lock.json`
compartido.

### `taskmanagerpwa`

- Root directory: `.`
- Build command: `npm install --include=optional && npm run build -w apps/taskmanager`
- Deploy command: `npx wrangler deploy --cwd apps/taskmanager`
- Preview deploy command: `npx wrangler versions upload --cwd apps/taskmanager`
- Required secret: `DATA_ENCRYPTION_KEY`
- Variables:
  - `GOOGLE_CLIENT_ID`
  - `MYNOTEBOOK_ORIGIN=https://mynotebook.fcovidalsegura.workers.dev`
  - `VITE_MYNOTEBOOK_ORIGIN=https://mynotebook.fcovidalsegura.workers.dev`

### `mynotebook`

- Root directory: `.`
- Build command: `npm install --include=optional && npm run build -w apps/mynotebook`
- Deploy command: `npx wrangler deploy --cwd apps/mynotebook`
- Preview deploy command: `npx wrangler versions upload --cwd apps/mynotebook`
- Variables:
  - `VITE_TASKMANAGER_ORIGIN=https://taskmanagerpwa.fcovidalsegura.workers.dev`

Alternativa: usar `apps/taskmanager` o `apps/mynotebook` como root directory, con
`npm install && npm run build` y `npx wrangler deploy`.
