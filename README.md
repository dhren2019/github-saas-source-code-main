# T3 Stack Project with Prisma and Bun

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app` and enhanced to work seamlessly with [Bun](https://bun.sh/).

## What's Included?

This project utilizes the following technologies:

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Getting Started

### **Install Bun on macOS**

1. Open your terminal.
2. Run the following command to install Bun:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
3. Add Bun to your PATH (if not automatically added):
   ```bash
   export PATH="$HOME/.bun/bin:$PATH"
   ```
4. Verify the installation:
   ```bash
   bun --version
   ```

### **Install Dependencies**

1. Clone this repository:
   ```bash
   https://github.com/dhren2019/github-saas.git
   cd github-saas
   ```
2. Install dependencies using Bun:
   ```bash
   bun install
   ```

### **Configure Environment Variables**

Create a `.env` file in the root of the project and configure your database and other necessary variables:

```env
# When adding additional environment variables, the schema in "/src/env.js"
# should be updated accordingly.

# Prisma
# https://www.prisma.io/docs/reference/database-reference/connection-urls#env
DATABASE_URL="postgresql://neondb_owner:3SjmZIw9BsgW@ep-round-sound-a5o2e0bs.us-east-2.aws.neon.tech/neondb?sslmode=require"

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_cmVsYXhpbmctd2VyZXdvbGYtNDAuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=sk_test_lnmqXtRputjypEqogJKcoc4vFPUhkdkXgPQIA2ZMZP
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

OPENAI_API_KEY=''

NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/sync-user

GEMINI_API_KEY='AIzaSyAZBRyQTljYcycRzA98Z96ZGIB_OFOorYc'

ASSEMBLYAI_API_KEY='63bdb55c965041cab0e94a3d3c61c6f6'

NEXT_PUBLIC_URL='http://localhost:3000'

STRIPE_SECRET_KEY='sk_test_51QJAVfIE5WYA8UpfLyyrT8skjKun03nN6eWLzNPLZl2zoj4OPCDNLVvxu6w4EzTOYCDPmBl3URgfuSGPfSLYdlvn00VybLf0cr'  
STRIPE_PUBLISHABLE_KEY='pk_test_51QJAVfIE5WYA8UpfEZJ4abiZILglHdyqaEgyYgosmq3UQ3FPC9aTBM0OyHLeYYsxTJjtuOVaJwnMnmRjj9ZkD01300l6083BKz'
STRIPE_WEBHOOK_SECRET='whsec_2b357712e46e9cdecbddb77f6f0a6371de31abea214359a9494e729cda0c3d66'
```

In addition, update the authentication key for GitHub in `src/lib/github.ts` and `github-loader`:

```typescript
const octokit = new Octokit({
    auth: ''
});
```

## Prisma Commands with Bun

Here are all the Prisma commands you may need during development:

- **Generate Prisma Client**
  ```bash
  bun run prisma:generate
  ```
  This will generate the Prisma Client based on your schema.

- **Run Migrations in Development**
  ```bash
  bun run prisma:migrate-dev
  ```
  Applies migrations to your development database.

- **Deploy Migrations in Production**
  ```bash
  bun run prisma:migrate-deploy
  ```
  Deploys all pending migrations to the production database.

- **Push Schema to Database**
  ```bash
  bun run prisma:push
  ```
  Syncs the Prisma schema with your database without creating migrations.

- **Open Prisma Studio**
  ```bash
  bun run prisma:studio
  ```
  Launches Prisma Studio to explore and manipulate your data visually.

### **Add the Commands to `package.json`**

To simplify running these commands, add them to the `scripts` section of your `package.json`:

```json
{
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate-dev": "prisma migrate dev",
    "prisma:migrate-deploy": "prisma migrate deploy",
    "prisma:push": "prisma db push",
    "prisma:studio": "prisma studio"
  }
}
```

You can then run them using:
```bash
bun run prisma:generate
```

## Development

- Start the development server:
  ```bash
  bun dev
  ```

- Lint the code:
  ```bash
  bun run lint
  ```

- Build the project:
  ```bash
  bun run build
  ```

## Learn More

To learn more about the T3 Stack and its components, check out the following resources:

- [T3 Stack Documentation](https://create.t3.gg/)
- [Prisma Documentation](https://prisma.io/docs)
- [Bun Documentation](https://bun.sh/docs)
- [Next.js Documentation](https://nextjs.org/docs)

## Deployment

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify), or [Docker](https://create.t3.gg/en/deployment/docker).

