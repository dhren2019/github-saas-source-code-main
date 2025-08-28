# Instalación del Sistema de Deploy

## Resumen Ejecutivo

Has implementado un **sistema completo de deploy automático** similar a Vercel que permite:
- ✅ Deploy con un clic desde el dashboard
- ✅ Subdominios automáticos (`proyecto.deploys.dionysus.dev`)
- ✅ Múltiples ambientes (preview/production)
- ✅ Variables de entorno configurables
- ✅ Logs en tiempo real
- ✅ Integración con GitHub Actions
- ✅ Soporte para Vercel, Netlify, Render

## Pasos de Instalación

### 1. Actualizar Base de Datos

```bash
# Aplicar cambios al schema
npx prisma db push

# Verificar que las tablas se crearon
npx prisma studio
```

### 2. Configurar Variables de Entorno

Agregar a tu `.env` (NO commitear):

```bash
# Deploy System - GitHub Actions
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Deploy System - DNS (Cloudflare)
CLOUDFLARE_ZONE_ID=your_zone_id
CLOUDFLARE_API_TOKEN=your_api_token
```

### 3. Configurar DNS (Cloudflare)

```bash
# 1. Comprar dominio (ej: dionysus.dev)
# 2. Configurar wildcard DNS record:
Type: CNAME
Name: *.deploys
Content: deploys.dionysus.dev (o tu servidor proxy)
TTL: Auto
```

### 4. Configurar GitHub Secrets (Por Repositorio)

Los usuarios necesitan agregar estos secrets en sus repos:

```bash
# Settings > Secrets and variables > Actions
VERCEL_TOKEN=your_vercel_token
NETLIFY_TOKEN=your_netlify_token (opcional)
RENDER_API_KEY=your_render_key (opcional)
```

### 5. Instalar Dependencias

```bash
npm install octokit
```

### 6. Probar el Sistema

1. **Crear un proyecto** en Dionysus vinculado a GitHub
2. **Hacer clic en "Deploy project"** en el dashboard
3. **Configurar** branch, variables de entorno, etc.
4. **Iniciar deploy** y ver el progreso en tiempo real
5. **Acceder** al deploy en `subdominio.deploys.dionysus.dev`

## Archivos Creados/Modificados

### Backend
- ✅ `src/server/api/routers/deploy.ts` - Router tRPC para deploys
- ✅ `src/pages/api/deploy/callback.ts` - Webhook para GitHub Actions
- ✅ `src/server/api/root.ts` - Router agregado al tRPC principal
- ✅ `prisma/schema.prisma` - Modelos Deployment + enums

### Frontend
- ✅ `src/app/(protected)/dashboard/deploy-button.tsx` - UI completa de deploy

### CI/CD
- ✅ `.github/workflows/deploy.yml` - Workflow de GitHub Actions

### Documentación
- ✅ `DEPLOY_SYSTEM.md` - Documentación técnica completa
- ✅ `.env.example` - Variables de entorno actualizadas

## Flujo de Usuario Final

1. **Usuario hace clic** en "Deploy project" 
2. **Modal se abre** con configuración (branch, env vars, tipo)
3. **Sistema genera** subdominio único
4. **GitHub Action se dispara** automáticamente
5. **Build y deploy** ocurren en paralelo
6. **DNS se configura** automáticamente
7. **Usuario accede** a `https://subdominio.deploys.dionysus.dev`

## Características Implementadas

### ✅ Deploy Completo
- Detección automática de tipo de proyecto (Next.js, Vite, etc.)
- Build con variables de entorno personalizadas
- Deploy a múltiples providers (Vercel, Netlify, Render)
- Logs de build y deploy en tiempo real

### ✅ Subdominios Temporales
- Generación de subdominios únicos y deterministas
- Configuración automática de DNS via Cloudflare API
- HTTPS automático via Cloudflare
- TTL optimizado para updates rápidos

### ✅ UI Completa
- Modal con configuración avanzada
- Historial de deploys con estados en tiempo real
- Logs detallados y enlaces a GitHub Actions
- Botones para copiar URLs y abrir deploys
- Cancelación de deploys en progreso

### ✅ Integración GitHub
- Disparo de workflows via GitHub API
- Callback bidireccional para actualizaciones de estado
- Manejo de secrets de usuario de forma segura
- Links directos a workflow runs

## Próximos Pasos (Opcionales)

### Mejoras MVP
- [ ] Auto-deploy en push a branch específicas
- [ ] Preview deploys para Pull Requests
- [ ] Custom domains para usuarios premium
- [ ] Métricas de uso y analytics

### Integraciones Avanzadas
- [ ] Slack/Discord notifications
- [ ] Deploy hooks y webhooks
- [ ] A/B testing entre deploys
- [ ] Rollback con un clic

## Troubleshooting

### Error: "Property 'deployment' does not exist"
```bash
# Regenerar cliente Prisma
npx prisma generate
```

### Error: "GitHub token invalid"
```bash
# Verificar token tiene permisos de Actions
# Scope requerido: repo, workflow
```

### Error: "DNS record creation failed"
```bash
# Verificar Cloudflare credentials
# Zone ID y API token válidos
```

### Error: "Workflow dispatch failed"
```bash
# Verificar que deploy.yml existe en el repo del usuario
# Verificar que el repo tiene los secrets necesarios
```

## Soporte

Para problemas o mejoras:
1. Revisar logs en GitHub Actions del repositorio del usuario
2. Verificar callback API en logs del servidor
3. Comprobar estado del deployment en la base de datos
4. Validar configuración DNS en Cloudflare

¡Tu sistema de deploy está listo para usar! 🚀
