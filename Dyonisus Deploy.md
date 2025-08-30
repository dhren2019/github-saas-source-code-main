Dyonisus Deploy — Guía rápida (MVP integrado)

Resumen y propósito
-------------------
Este documento describe cómo añadir un servicio de deploy integrado ("Dyonisus Deploy") dentro de este repositorio como MVP. Incluye estructura propuesta, modelos Prisma, endpoints mínimos, worker/cola, almacenamiento de artefactos, seguridad y pasos prácticos para implementar y probar localmente.

Checklist breve
---------------
- [ ] Decidir enfoque: usar la misma base de datos (recomendado para MVP).
- [ ] Añadir modelos Prisma (Projects, Deployments, ProviderCredential, enum DeploymentStatus).
- [ ] Ejecutar migración y generar Prisma Client.
- [ ] Implementar endpoints API: create, status, cancel, webhook.
- [ ] Implementar worker (BullMQ + Redis recomendado) o worker simple para MVP.
- [ ] Configurar S3-compatible para artefactos y logs (no guardar blobs en DB).
- [ ] Encriptar credenciales y rotar claves.

Estructura mínima recomendada
----------------------------
Colocar dentro de `src/server/deploy/`:

- `api/`
  - `create.ts` — endpoint que crea Deployment y encola job
  - `status.ts` — consulta estado del deployment
  - `cancel.ts` — cancelar job
  - `webhook.ts` — recibir callbacks/updates
- `providers/`
  - `baseProvider.ts` — interfaz/abstract
  - `dockerProvider.ts` — builder que crea container/artifact
  - `staticProvider.ts` — builder para sitios estáticos
- `worker/`
  - `index.ts` — worker que consume la cola y ejecuta builds
  - `buildRunner.ts` — lógica de ejecución del build
- `queue/`
  - `queue.ts` — configuración de BullMQ (o stub in-memory)
- `utils/`
  - `s3.ts` — helpers S3
  - `crypto.ts` — helpers para cifrar credenciales (KMS/app-key)

Modelos Prisma sugeridos
------------------------
Añade este bloque en `prisma/schema.prisma` (integrar con el esquema actual):

```prisma
model Project {
  id          String       @id @default(cuid())
  ownerId     String
  name        String
  githubUrl   String
  createdAt   DateTime     @default(now())
  deployments Deployment[]
}

model Deployment {
  id            String    @id @default(cuid())
  projectId     String
  commitSha     String
  branch        String?
  status        DeploymentStatus @default(PENDING)
  provider      String
  providerMeta  Json?
  artifactKey   String?   // referencia en S3
  logsKey       String?   // referencia en S3
  startedAt     DateTime?
  finishedAt    DateTime?
  createdAt     DateTime  @default(now())

  project Project @relation(fields: [projectId], references: [id])
}

model ProviderCredential {
  id            String   @id @default(cuid())
  userId        String
  provider      String
  encryptedData String   // cifrado con KMS o clave de la app
  createdAt     DateTime @default(now())
}

enum DeploymentStatus {
  PENDING
  BUILDING
  READY
  FAILED
  CANCELLED
}
```

Notas del modelo
----------------
- No almacenar artefactos en la DB: usar `artifactKey`/`logsKey` apuntando a S3.
- `providerMeta` permite guardar respuestas específicas del proveedor.
- `ProviderCredential.encryptedData` debe cifrarse con KMS o con una clave de la app (evitar texto plano).

Endpoints mínimos (contrato)
----------------------------
- POST `/api/deploy/create`
  - Input: `{ projectId, commitSha, branch?, provider?, options? }`
  - Flow: crea Deployment con status PENDING y encola job
  - Output: `{ deploymentId }`

- GET `/api/deploy/:id`
  - Output: `{ id, status, startedAt, finishedAt, artifactUrl?, logsUrl?, provider }`

- POST `/api/deploy/:id/cancel`
  - Cancela job en cola si es posible y pone status CANCELLED

- POST `/api/deploy/webhook`
  - Callback para recibir updates (status, logsUrl, artifactUrl)

Implementación recomendada
--------------------------
- Autenticación: endpoints protegidos. Reusar el sistema de autenticación/`protectedProcedure` o middleware ya presente en el repo.
- Validación: comprobar que `projectId` pertenece al usuario.
- Quotas: comprobar créditos/limitaciones antes de aceptar `create`.

Worker y cola
--------------
- Recomendado: BullMQ + Redis (sencillo y robusto). Alternativa MVP: worker en proceso único con polling.

Job flow (resumen):
1. API crea `Deployment` (PENDING) y encola job con `{ deploymentId }`.
2. Worker toma job, actualiza status BUILDING y `startedAt`.
3. Worker ejecuta build:
   - Para containers: `docker build` o BuildKit (recomendado) y subir imagen o artifact a registry/S3.
   - Para static: `npm ci && npm run build`, empaquetar `dist` y subir a S3.
4. Stream logs mientras build corre; subir logs o almacenar enlaces.
5. Si éxito: status READY, guardar `artifactKey` y `finishedAt`.
6. Si falla: status FAILED y guardar logs.

Worker (esqueleto) — pseudo TypeScript
```ts
// worker/index.ts
import { Worker } from 'bullmq'
import { prisma } from '@/server/db'
import { runBuild } from './buildRunner'

const worker = new Worker('deploys', async job => {
  const { deploymentId } = job.data
  await prisma.deployment.update({ where: { id: deploymentId }, data: { status: 'BUILDING', startedAt: new Date() } })
  try {
    const result = await runBuild(deploymentId)
    await prisma.deployment.update({ where: { id: deploymentId }, data: { status: 'READY', artifactKey: result.artifactKey, logsKey: result.logsKey, finishedAt: new Date() } })
  } catch (err) {
    await prisma.deployment.update({ where: { id: deploymentId }, data: { status: 'FAILED', finishedAt: new Date() } })
  }
})
```

Storage de artefactos y logs
---------------------------
- Usar S3-compatible (AWS S3, DigitalOcean Spaces, MinIO en local). Mantener bucket por entorno.
- Guardar solo claves en DB (`artifactKey`, `logsKey`).
- Para logs en tiempo real, puedes usar WebSockets y guardar un archivo final en S3.

Seguridad y secretos
--------------------
- Nunca comitear `.env.local`.
- Rotar inmediatamente las claves que aparecen en el repo/env.
- Guardar credenciales cifradas en DB y / o usar KMS (AWS KMS/GCP KMS).
- Minimizar permisos de tokens (p.ej. tokens de GitHub con scope limitado).

Multitenancy y aislamiento
--------------------------
- Para MVP: shared schema con columna `ownerId`/`projectId` y checks de acceso.
- Para producción: considerar schema per tenant o DB per tenant si se requiere aislamiento legal/seguridad.
- Implementar RLS (Row Level Security) en Postgres si es necesario.

Cuotas y límites
----------------
- Implementar quotas: número de builds concurrentes por usuario, minutos de build, storage usado.
- Validar cuotas en `/api/deploy/create`.

Comandos para desarrollo local
------------------------------
(Asumiendo PowerShell en Windows; para bash sustituir los comandos si es necesario)

```powershell
# instalar dependencias
npm install

# migración y generación prisma (tras añadir los modelos en schema.prisma)
npx prisma migrate dev --name add-deployments
npx prisma generate

# iniciar redis (si usas Docker)
docker run -p 6379:6379 -d redis

# iniciar worker (ejemplo simple)
node ./src/server/deploy/worker/index.js

# iniciar app
npm run dev
```

Observabilidad y pruebas
------------------------
- Tests unitarios para providers y runner (simular fallos y success).
- Tests e2e para flujo completo.
- Métricas: contar builds por día, duración media, % fallos.

Siguientes pasos (opcional, sugeridos)
--------------------------------------
1. Implementar scaffold básico: modelos Prisma + migración + Endpoints tRPC/Next API.
2. Implementar worker minimal que haga un "fake build" (sleep + subir un archivo dummy a S3) para validar el flujo.
3. Reemplazar fake build por `docker build` o runner para static sites.
4. Añadir UI en `src/app/(protected)/deploy/` para crear deployments y ver historial.

Contacto
--------
Si quieres, implemento el scaffold inicial (modelos + API routes + worker stub) en este repo. Indica si prefieres:
- builds por **Docker containers** (recomendado para apps dinámicas)
- builds por **static serverless** (más barato/rápido para sitios estáticos)


---
*Archivo generado automáticamente: Dyonisus Deploy.md*
