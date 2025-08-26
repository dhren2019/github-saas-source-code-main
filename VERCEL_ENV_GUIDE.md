## Variables de Entorno para Vercel

### 🔑 VARIABLES CRÍTICAS (NECESARIAS PARA QUE FUNCIONE)

# Database
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# Clerk (Autenticación)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_tu_clave_aqui
CLERK_SECRET_KEY=sk_test_tu_clave_aqui
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/sync-user

# URL de la app (cambiar por tu dominio de Vercel)
NEXT_PUBLIC_URL=https://tu-app-name.vercel.app

### 🤖 APIS OPCIONALES (puedes agregar después)

# OpenAI
OPENAI_API_KEY=sk-proj-tu_clave_aqui

# Google Gemini
GEMINI_API_KEY=tu_clave_aqui

# AssemblyAI
ASSEMBLYAI_API_KEY=tu_clave_aqui

# Stripe
STRIPE_SECRET_KEY=sk_test_tu_clave_aqui
STRIPE_PUBLISHABLE_KEY=pk_test_tu_clave_aqui
STRIPE_WEBHOOK_SECRET=whsec_tu_clave_aqui

# GitHub (opcional)
GITHUB_TOKEN=ghp_tu_token_aqui

### ⚙️ CONFIGURACIÓN DE BUILD
SKIP_ENV_VALIDATION=true
