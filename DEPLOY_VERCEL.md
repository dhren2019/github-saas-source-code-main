 # Despliegue en Vercel — pasos recomendados (basado en el tutorial)

 Este archivo resume los pasos exactos para desplegar este proyecto en Vercel siguiendo el tutorial.

 Requisitos previos

 - Añade `.env` a `.gitignore`.
 - Asegúrate de tener `prisma` y `tailwindcss` en `dependencies`.
 - Asegúrate de no commitear artefactos de build (`.next/`) ni archivos que contengan secretos.

 1) Añadir variables de entorno en Vercel

 - Abre tu proyecto en el dashboard de Vercel.
 - Ve a Settings -> Environment Variables.
 - Añade cada variable listada en el archivo local `.env` (NO subir `.env` al repo):
  • Recomendación: usar `.env.example` como plantilla. Añade en Vercel (Settings → Environment Variables) las variables que declares en `.env`:
    - DATABASE_URL
    - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    - CLERK_SECRET_KEY
    - NEXT_PUBLIC_CLERK_SIGN_IN_URL
    - NEXT_PUBLIC_CLERK_SIGN_UP_URL
    - NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL
    - OPENAI_API_KEY o GEMINI_API_KEY
    - ASSEMBLYAI_API_KEY
    - NEXT_PUBLIC_URL
    - STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET

 Usa el entorno "Preview" o "Production" según corresponda. No pongas claves en `vercel.json`.

 2) Configuración del build

 - Vercel detecta Next.js automáticamente. El comando que se ejecutará por defecto es equivalente a:

 ```powershell
 npm ci --legacy-peer-deps && npm run build
 ```

Antes de commitear, asegúrate de no incluir la carpeta `.next/` ni otros artefactos de build. Si accidentalmente añadiste `.next/` al repo, elimínala y realiza un commit que la borre antes de empujar.

 - Asegúrate de que `prisma` esté en `dependencies` para que `postinstall: prisma generate` funcione en el entorno de Vercel.

 3) Revisiones importantes (errores comunes y soluciones)

 - Error `prisma: command not found`:
   - Solución: mover `prisma` a `dependencies` (no solo en `devDependencies`) y hacer commit.
 - Error `Cannot find module 'tailwindcss'`:
   - Solución: mover `tailwindcss` a `dependencies`.
 - Error `Module not found: Can't resolve '@/...'`:
   - Solución: comprobar `tsconfig.json` que tenga `"paths": { "@/*": ["./src/*"] }` y que los archivos existan.
 - Errores por imports pesados en páginas (buildup grande): usar componentes server-side, `dynamic()` y lazy-load de librerías pesadas.

 4) Commits y push

 - Haz commit y push de:
   - `package.json` (cambios de dependencies)
   - `package-lock.json` (o `bun.lockb` si usas Bun)
   - `next.config.js`, `tsconfig.json` si los modificaste
 - Después de push, Vercel iniciará un nuevo despliegue por la integración con Git.

 5) Verificación post-deploy

 - Revisa logs de build en Vercel si algo falla.
 - Si `prisma generate` falla, revisa que `DATABASE_URL` esté en Settings -> Environment Variables.

 6) Opcional — análisis del bundle (para optimizar tamaño)

 - Instalar `@next/bundle-analyzer` o usar `source-map-explorer` localmente como en el tutorial.

 Comandos útiles (local)

 ```powershell
 # instalar deps (usar --legacy-peer-deps si hay conflictos)
 npm install --legacy-peer-deps

 # generar cliente prisma (se ejecuta también en postinstall)
 npx prisma generate

 # aplicar schema al DB en dev
 npx prisma db push

 # build local
 npm run build
 ```

 Notas finales

 - No incluyas secretos en el repo.
 - Si quieres que configure `vercel.json` para reglas o rutas específicas, lo puedo añadir, pero no debe contener secretos.

