# Configuración del Sistema de Deploy

## 🚀 Configuración de Providers

Tu plataforma ahora soporta deploys con **Vercel CLI** y **Netlify CLI**. Los usuarios pueden elegir su provider preferido en el popup de deploy.

### 1. Configurar Vercel Token

1. **Instalar Vercel CLI (opcional, para obtener token):**
   ```bash
   npm install -g vercel
   ```

2. **Obtener token de Vercel:**
   ```bash
   vercel login
   # Después de autenticarte, obtén tu token:
   vercel --token
   ```

3. **Añadir token a tu .env.local:**
   ```bash
   VERCEL_TOKEN=your_actual_vercel_token_here
   ```

### 2. Configurar Netlify Token

1. **Instalar Netlify CLI (opcional, para obtener token):**
   ```bash
   npm install -g netlify-cli
   ```

2. **Obtener token de Netlify:**
   - Ve a [Netlify Personal Access Tokens](https://app.netlify.com/user/applications#personal-access-tokens)
   - Clic en "New access token"
   - Dale un nombre como "Deploy Platform"
   - Copia el token generado

3. **Añadir token a tu .env.local:**
   ```bash
   NETLIFY_TOKEN=your_actual_netlify_token_here
   ```

### 3. Variables de Entorno Completas

Tu archivo `.env.local` debe incluir:

```bash
# ... otras variables existentes ...

# Deploy Providers
VERCEL_TOKEN=vercel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NETLIFY_TOKEN=nfp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 🔧 Cómo Funciona

### Flujo de Deploy

1. **Usuario inicia deploy:** Selecciona provider (Vercel/Netlify), branch, tipo y variables de entorno
2. **Backend crea registro:** Se crea un registro en la BD con estado PENDING
3. **Worker procesa:** El sistema ejecuta en background:
   - Clona el repositorio especificado
   - Instala dependencias (`npm ci`)
   - Configura variables de entorno si las hay
   - Ejecuta deploy con la CLI correspondiente
   - Actualiza el estado en la BD

### Vercel Deploy Process

```bash
# El sistema ejecuta internamente:
git clone --depth 1 --branch {branch} {repo_url}
cd {temp_dir}
npm ci --legacy-peer-deps
npx vercel --confirm --token {VERCEL_TOKEN} --prod --name {subdomain}
```

### Netlify Deploy Process

```bash
# El sistema ejecuta internamente:
git clone --depth 1 --branch {branch} {repo_url}
cd {temp_dir}
npm ci --legacy-peer-deps
npm run build  # o npx next build
npx netlify deploy --prod --dir={build_dir} --auth={NETLIFY_TOKEN}
```

## 🎯 Características

### ✅ Lo que está implementado:

- **Selector de provider** en la UI (Vercel/Netlify)
- **Deploy directo** usando CLIs oficiales
- **Variables de entorno** personalizadas por deploy
- **Estados en tiempo real** (PENDING → BUILDING → DEPLOYING → READY/FAILED)
- **Logs de deploy** visibles en la interfaz
- **URLs temporales** generadas automáticamente
- **Historial de deploys** por proyecto

### 📝 Próximas mejoras sugeridas:

- Soporte para más providers (Render, Railway, etc.)
- Builds en contenedores Docker (más seguro)
- Cache de dependencias para builds más rápidos
- Límites de tiempo para builds
- Notificaciones por email/webhook cuando el deploy termine

## 🔒 Seguridad

- Los tokens se almacenan como variables de entorno del servidor
- Los repos se clonan en directorios temporales que se limpian automáticamente
- Las variables de entorno del usuario se pasan de forma segura a los providers
- Los procesos de build se ejecutan en modo aislado

## 🛠️ Troubleshooting

### Error: "VERCEL_TOKEN no configurado"
- Asegúrate de añadir `VERCEL_TOKEN` a tu `.env.local`
- Reinicia el servidor de desarrollo después de añadir variables

### Error: "NETLIFY_TOKEN no configurado"
- Asegúrate de añadir `NETLIFY_TOKEN` a tu `.env.local`
- Verifica que el token tenga permisos suficientes

### Error: "No se encontró package.json"
- El repositorio debe tener un `package.json` válido
- Verifica que el branch especificado existe

### Build falla
- Revisa los logs en la interfaz para ver el error específico
- Asegúrate de que el proyecto se puede buildear localmente
- Verifica que las dependencias estén correctamente especificadas

## 🔄 Proceso de Deploy Paso a Paso

1. Usuario hace clic en "Deploy Project"
2. Selecciona provider, branch, tipo de deploy
3. Opcionalmente añade variables de entorno
4. Sistema crea registro con estado PENDING
5. Worker clone repositorio en directorio temporal
6. Instala dependencias (`npm ci`)
7. Configura variables de entorno (.env.production)
8. Ejecuta deploy con CLI del provider
9. Extrae URL del resultado
10. Actualiza registro a READY con la URL final
11. Limpia directorio temporal
12. Usuario ve la URL en la interfaz

¡Tu plataforma ya está lista para que los usuarios hagan deploys con un solo clic! 🎉
