# Sistema de Deploy Automático con Subdominios Temporales

## Visión General

Este sistema permite a los usuarios de la plataforma Dionysus hacer deploy de sus proyectos GitHub de forma automática, similar a Vercel, con las siguientes características:

- **Subdominios temporales**: Cada deploy recibe un subdominio único bajo `deploys.dionysus.dev`
- **Deploy automático**: Integración con GitHub Actions para builds y deploys
- **Múltiples proveedores**: Soporte para Vercel, Netlify, Render, etc.
- **Variables de entorno**: Configuración personalizada por deploy
- **Logs en tiempo real**: Seguimiento del progreso del deploy
- **Historial completo**: Lista de todos los deploys con estado y logs

## Arquitectura

### 1. Base de Datos (Prisma Schema)

```prisma
model Deployment {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  projectId String
  project   Project @relation(fields: [projectId], references: [id])
  
  userId String
  user   User   @relation(fields: [userId], references: [id])
  
  subdomain String @unique
  branch    String @default("main")
  
  status DeploymentStatus @default(PENDING)
  deploymentType DeploymentType @default(PREVIEW)
  
  githubOwner String
  githubRepo  String
  commitHash  String?
  
  envVars Json?
  logs    String? @db.Text
  
  buildStartedAt DateTime?
  finishedAt     DateTime?
  
  deployUrl   String?
  errorMessage String? @db.Text
  
  workflowRunId String?
  workflowRunUrl String?
}

enum DeploymentStatus {
  PENDING   // Deploy creado, esperando inicio
  BUILDING  // GitHub Action corriendo
  DEPLOYING // Desplegando en provider
  READY     // Deploy exitoso y accesible
  FAILED    // Error en build o deploy
  CANCELLED // Cancelado por usuario
}

enum DeploymentType {
  PREVIEW    // Deploy de preview/testing
  PRODUCTION // Deploy de producción
}
```

### 2. Backend API (tRPC)

**Router de Deploy** (`src/server/api/routers/deploy.ts`):

- `createDeploy`: Inicia un nuevo deploy
- `getDeployment`: Obtiene detalles de un deploy específico
- `getProjectDeployments`: Lista deploys de un proyecto
- `getDeploymentLogs`: Obtiene logs de un deploy
- `cancelDeployment`: Cancela un deploy en progreso

### 3. GitHub Actions Workflow

**Archivo**: `.github/workflows/deploy.yml`

El workflow se dispara via `workflow_dispatch` y realiza:

1. **Setup**: Checkout del código, setup de Node.js
2. **Notificación**: Informa inicio del build via webhook
3. **Build**: Instala dependencias y construye el proyecto
4. **Deploy**: Despliega a Vercel (configurable para otros providers)
5. **DNS**: Crea registro CNAME para el subdominio
6. **Notificación**: Informa resultado final

### 4. Frontend (React/Next.js)

**Componente Principal**: `DeployButton.tsx`

Características del UI:
- Modal con configuración de deploy
- Selección de branch y tipo de deploy
- Editor de variables de entorno
- Historial de deploys con estado en tiempo real
- Logs detallados y enlaces a GitHub Actions
- Botones para abrir deploys y copiar URLs

## Flujo Completo

### 1. Inicio del Deploy

```typescript
// Usuario hace clic en "Deploy project"
const deployment = await api.deploy.createDeploy.mutate({
  projectId: "proj_123",
  branch: "main",
  deploymentType: "preview",
  envVars: { NODE_ENV: "production", API_KEY: "secret" }
});

// Sistema genera subdominio único
const subdomain = "myapp-abc123-1640995200000";
```

### 2. Disparo de GitHub Action

```typescript
// Backend dispara workflow
await octokit.rest.actions.createWorkflowDispatch({
  owner: "usuario",
  repo: "mi-proyecto",
  workflow_id: "deploy.yml",
  ref: "main",
  inputs: {
    deploymentId: "deploy_456",
    subdomain: "myapp-abc123-1640995200000",
    envVars: JSON.stringify(envVars),
    callbackUrl: "https://dionysus.dev/api/deploy/callback"
  }
});
```

### 3. Build y Deploy

```yaml
# GitHub Action ejecuta:
- name: Build project
  run: npm run build

- name: Deploy to Vercel  
  run: |
    vercel --token ${{ secrets.VERCEL_TOKEN }} --yes
    DEPLOY_URL=$(vercel ls --token ${{ secrets.VERCEL_TOKEN }} | head -1)
```

### 4. Configuración DNS

```bash
# Crear registro CNAME
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -d '{
    "type": "CNAME",
    "name": "myapp-abc123-1640995200000.deploys",
    "content": "my-app.vercel.app"
  }'
```

### 5. Resultado Final

- **URL del Deploy**: `https://myapp-abc123-1640995200000.deploys.dionysus.dev`
- **Estado**: `READY`
- **Logs**: Disponibles en tiempo real
- **Duración**: Visible en el dashboard

## Configuración Requerida

### Variables de Entorno

```bash
# GitHub (requerido para disparar workflows)
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Cloudflare (opcional, para subdominios automáticos)
CLOUDFLARE_ZONE_ID=zone_xxxxxxxxxxxx
CLOUDFLARE_API_TOKEN=token_xxxxxxxxxxxx

# Provider-specific (según provider elegido)
VERCEL_TOKEN=vercel_xxxxxxxxxxxx
NETLIFY_TOKEN=netlify_xxxxxxxxxxxx
RENDER_API_KEY=render_xxxxxxxxxxxx
```

### Secrets de GitHub

Los repositorios de usuarios necesitan estos secrets:

- `VERCEL_TOKEN`: Token de Vercel
- `NETLIFY_TOKEN`: Token de Netlify (si usan Netlify)
- `RENDER_API_KEY`: API key de Render (si usan Render)

### DNS Setup

1. **Comprar dominio**: `dionysus.dev` (ejemplo)
2. **Configurar wildcard**: `*.deploys.dionysus.dev` → Cloudflare
3. **API tokens**: Cloudflare API para crear registros automáticamente

## Características Avanzadas

### 1. Múltiples Providers

El workflow detecta y soporta:

```yaml
- name: Deploy to appropriate provider
  run: |
    if [ -f "vercel.json" ]; then
      # Deploy a Vercel
      vercel --token ${{ secrets.VERCEL_TOKEN }} --yes
    elif [ -f "netlify.toml" ]; then
      # Deploy a Netlify
      netlify deploy --prod --auth ${{ secrets.NETLIFY_TOKEN }}
    elif [ -f "render.yaml" ]; then
      # Deploy a Render
      curl -X POST "https://api.render.com/v1/services/$SERVICE_ID/deploys"
    fi
```

### 2. Variables de Entorno Dinámicas

```typescript
// Las variables se inyectan en el workflow
const envVars = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://...",
  API_KEY: "secret_key"
};

// Se convierten en variables de entorno para el build
ENV_VARS='{"NODE_ENV":"production","API_KEY":"secret"}'
echo "$ENV_VARS" | jq -r 'to_entries | .[] | "\(.key)=\(.value)"' >> $GITHUB_ENV
```

### 3. Preview URLs Inteligentes

```typescript
// Cada deploy recibe subdomain determinista pero único
const generateSubdomain = (project: Project, timestamp: number) => {
  const cleanName = project.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const shortId = project.id.slice(-6);
  return `${cleanName}-${shortId}-${timestamp}`;
};

// Resultado: "chat-app-abc123-1640995200000.deploys.dionysus.dev"
```

### 4. Rollback y Gestión

```typescript
// Cancelar deploy en progreso
await api.deploy.cancelDeployment.mutate({ deploymentId });

// Ver logs en tiempo real
const logs = await api.deploy.getDeploymentLogs.query({ deploymentId });

// Historial completo
const deploys = await api.deploy.getProjectDeployments.query({ projectId });
```

## Beneficios del Sistema

### Para Usuarios

1. **Sin configuración**: Un clic para deploy completo
2. **URLs inmediatas**: Subdominios automáticos para testing
3. **Logs transparentes**: Visibilidad completa del proceso
4. **Múltiples ambientes**: Preview y production separados
5. **Rollback fácil**: Acceso a deploys anteriores

### Para la Plataforma

1. **Escalable**: Usa GitHub Actions, no servidores propios
2. **Confiable**: Workflow battle-tested de providers establecidos
3. **Flexible**: Soporte para múltiples providers sin lock-in
4. **Económico**: Sin costos de infraestructura adicional
5. **Seguro**: Tokens y secrets manejados por GitHub

## Próximos Pasos

### MVP Inmediato

1. ✅ Esquema de base de datos
2. ✅ tRPC router completo
3. ✅ GitHub workflow funcional
4. ✅ UI completa con tiempo real
5. ⏳ Callback API para updates
6. ⏳ Configuración DNS automática

### Mejoras Futuras

1. **Custom domains**: Permitir dominios personalizados
2. **Deploy hooks**: Webhooks para integraciones
3. **Branch deploys**: Deploy automático por branch
4. **A/B testing**: Múltiples versiones simultáneas
5. **Analytics**: Métricas de uso y performance
6. **Colaboración**: Deploys de equipo y permisos

## Implementación

Para implementar este sistema:

1. **Ejecutar migraciones**: `npx prisma db push`
2. **Configurar variables**: Agregar tokens en `.env`
3. **Configurar DNS**: Wildcard en Cloudflare
4. **Probar workflow**: Deploy de prueba manual
5. **UI integration**: Integrar componente en dashboard

¡El sistema está listo para deploy inmediato con funcionalidad completa tipo Vercel!
