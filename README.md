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
