import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { Octokit } from "octokit";
import { env } from "@/env";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import os from "os";

const execAsync = promisify(exec);

export const deployRouter = createTRPCRouter({
  // Crear un nuevo deploy
  createDeploy: protectedProcedure
    .input(z.object({ 
      projectId: z.string(),
      branch: z.string().default("main"),
      envVars: z.record(z.string()).optional(),
      deploymentType: z.enum(["preview", "production"]).default("preview"),
      provider: z.enum(["vercel", "netlify"]).default("vercel")
    }))
    .mutation(async ({ ctx, input }) => {
      // Verificar que el usuario tenga acceso al proyecto
      const userProject = await ctx.db.userToProject.findFirst({
        where: {
          userId: ctx.user.userId!,
          projectId: input.projectId,
        },
        include: {
          project: true,
        },
      });

      if (!userProject) {
        throw new Error("No tienes acceso a este proyecto");
      }

      const project = userProject.project;
      if (!project.githubUrl) {
        throw new Error("Proyecto no tiene repositorio GitHub vinculado");
      }

      // Extraer owner y repo del URL de GitHub
      const urlParts = project.githubUrl.replace("https://github.com/", "").split("/");
      const owner = urlParts[0];
      const repo = urlParts[1];

      if (!owner || !repo) {
        throw new Error("URL de GitHub inválida");
      }

      // Generar subdominio único
      const timestamp = Date.now();
      const subdomain = `${project.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${project.id.slice(-6)}-${timestamp}`;
      
      // Crear registro de deploy en base de datos
      const deployment = await ctx.db.deployment.create({
        data: {
          projectId: input.projectId,
          userId: ctx.user.userId!,
          subdomain,
          branch: input.branch,
          status: "PENDING",
          deploymentType: input.deploymentType.toUpperCase() as "PREVIEW" | "PRODUCTION",
          envVars: input.envVars || {},
          githubOwner: owner,
          githubRepo: repo,
          provider: input.provider,
        },
      });

      // Ejecutar deploy según el provider seleccionado
      if (input.provider === "vercel") {
        deployWithVercel(deployment.id, project.githubUrl, input.branch, input.envVars || {}, subdomain)
          .catch(async (error) => {
            await ctx.db.deployment.update({
              where: { id: deployment.id },
              data: { status: "FAILED", errorMessage: error.message },
            });
          });
      } else if (input.provider === "netlify") {
        deployWithNetlify(deployment.id, project.githubUrl, input.branch, input.envVars || {}, subdomain)
          .catch(async (error) => {
            await ctx.db.deployment.update({
              where: { id: deployment.id },
              data: { status: "FAILED", errorMessage: error.message },
            });
          });
      }

      return {
        deploymentId: deployment.id,
        subdomain: `${subdomain}.${input.provider === "vercel" ? "vercel.app" : "netlify.app"}`,
        status: "PENDING",
        provider: input.provider,
      };
    }),

  // Obtener estado de un deploy
  getDeployment: protectedProcedure
    .input(z.object({ deploymentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const deployment = await ctx.db.deployment.findUnique({
        where: { id: input.deploymentId },
        include: {
          project: true,
          user: true,
        },
      });

      if (!deployment) {
        throw new Error("Deploy no encontrado");
      }

      // Verificar acceso
      const hasAccess = await ctx.db.userToProject.findFirst({
        where: {
          userId: ctx.user.userId!,
          projectId: deployment.projectId,
        },
      });

      if (!hasAccess) {
        throw new Error("No tienes acceso a este deploy");
      }

      return deployment;
    }),

  // Listar todos los deploys de un proyecto
  getProjectDeployments: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verificar acceso al proyecto
      const hasAccess = await ctx.db.userToProject.findFirst({
        where: {
          userId: ctx.user.userId!,
          projectId: input.projectId,
        },
      });

      if (!hasAccess) {
        throw new Error("No tienes acceso a este proyecto");
      }

      return await ctx.db.deployment.findMany({
        where: { projectId: input.projectId },
        include: {
          user: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20, // Limitar a los últimos 20 deploys
      });
    }),

  // Obtener logs de un deploy
  getDeploymentLogs: protectedProcedure
    .input(z.object({ deploymentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const deployment = await ctx.db.deployment.findUnique({
        where: { id: input.deploymentId },
      });

      if (!deployment) {
        throw new Error("Deploy no encontrado");
      }

      // Verificar acceso
      const hasAccess = await ctx.db.userToProject.findFirst({
        where: {
          userId: ctx.user.userId!,
          projectId: deployment.projectId,
        },
      });

      if (!hasAccess) {
        throw new Error("No tienes acceso a este deploy");
      }

      // Si hay GitHub token, obtener logs desde GitHub Actions
      if (env.GITHUB_TOKEN) {
        try {
          const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
          
          // Buscar workflow runs recientes
          const runs = await octokit.rest.actions.listWorkflowRuns({
            owner: deployment.githubOwner,
            repo: deployment.githubRepo,
            workflow_id: "deploy.yml",
            per_page: 10,
          });

          // Encontrar el run que corresponde a nuestro deploy
          const relevantRun = runs.data.workflow_runs.find(run => 
            Math.abs(new Date(run.created_at).getTime() - deployment.createdAt.getTime()) < 300000 // 5 minutos
          );

          if (relevantRun) {
            return {
              logs: deployment.logs || "",
              githubRunUrl: relevantRun.html_url,
              githubStatus: relevantRun.status,
              githubConclusion: relevantRun.conclusion,
            };
          }
        } catch (error) {
          console.error("Error obteniendo logs de GitHub:", error);
        }
      }

      return {
        logs: deployment.logs || "Logs no disponibles",
        githubRunUrl: null,
        githubStatus: null,
        githubConclusion: null,
      };
    }),

  // Cancelar un deploy
  cancelDeployment: protectedProcedure
    .input(z.object({ deploymentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deployment = await ctx.db.deployment.findUnique({
        where: { id: input.deploymentId },
      });

      if (!deployment) {
        throw new Error("Deploy no encontrado");
      }

      // Verificar acceso y que el deploy esté en progreso
      const hasAccess = await ctx.db.userToProject.findFirst({
        where: {
          userId: ctx.user.userId!,
          projectId: deployment.projectId,
        },
      });

      if (!hasAccess) {
        throw new Error("No tienes acceso a este deploy");
      }

      if (!["PENDING", "BUILDING"].includes(deployment.status)) {
        throw new Error("Este deploy no se puede cancelar");
      }

      // Actualizar estado
      await ctx.db.deployment.update({
        where: { id: input.deploymentId },
        data: { 
          status: "CANCELLED",
          finishedAt: new Date(),
        },
      });

      return { success: true };
    }),
});

// Función para deploy con Vercel CLI
async function deployWithVercel(
  deploymentId: string,
  repoUrl: string,
  branch: string,
  envVars: Record<string, string>,
  subdomain: string
) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "deploy-"));
  
  try {
    await updateDeploymentStatus(deploymentId, "BUILDING", "Clonando repositorio...");
    
    // Clonar repositorio
    await execAsync(`git clone --depth 1 --branch ${branch} ${repoUrl} ${tmpDir}`);
    
    // Verificar package.json
    const packageJsonPath = path.join(tmpDir, "package.json");
    try {
      await fs.access(packageJsonPath);
    } catch {
      throw new Error("No se encontró package.json en el repositorio");
    }

    await updateDeploymentStatus(deploymentId, "BUILDING", "Instalando dependencias...");
    
    // Instalar dependencias
    await execAsync("npm ci --legacy-peer-deps", { cwd: tmpDir });

    // Configurar variables de entorno
    if (Object.keys(envVars).length > 0) {
      const envFile = Object.entries(envVars)
        .map(([key, value]) => `${key}="${value}"`)
        .join('\n');
      await fs.writeFile(path.join(tmpDir, ".env.production"), envFile);
    }

    await updateDeploymentStatus(deploymentId, "DEPLOYING", "Desplegando en Vercel...");
    
    const vercelToken = env.VERCEL_TOKEN || process.env.VERCEL_TOKEN;
    if (!vercelToken) {
      throw new Error("VERCEL_TOKEN no configurado");
    }

    const deployCommand = [
      "npx vercel",
      "--confirm",
      `--token "${vercelToken}"`,
      "--prod",
      `--name "${subdomain}"`,
    ].join(" ");

    const { stdout } = await execAsync(deployCommand, { 
      cwd: tmpDir,
      env: { ...process.env, VERCEL_TOKEN: vercelToken }
    });

    // Extraer URL del output
    const urlMatch = stdout.match(/https:\/\/[^\s]+/);
    const deployUrl = urlMatch ? urlMatch[0] : null;

    if (!deployUrl) {
      throw new Error("No se pudo obtener la URL del deployment");
    }

    await updateDeploymentStatus(deploymentId, "READY", "Deploy completado exitosamente", deployUrl);

  } catch (error: any) {
    await updateDeploymentStatus(deploymentId, "FAILED", `Error: ${error.message}`);
    throw error;
  } finally {
    // Limpiar directorio temporal
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Función para deploy con Netlify CLI
async function deployWithNetlify(
  deploymentId: string,
  repoUrl: string,
  branch: string,
  envVars: Record<string, string>,
  subdomain: string
) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "deploy-"));
  
  try {
    await updateDeploymentStatus(deploymentId, "BUILDING", "Clonando repositorio...");
    
    // Clonar repositorio
    await execAsync(`git clone --depth 1 --branch ${branch} ${repoUrl} ${tmpDir}`);
    
    // Verificar package.json
    const packageJsonPath = path.join(tmpDir, "package.json");
    try {
      await fs.access(packageJsonPath);
    } catch {
      throw new Error("No se encontró package.json en el repositorio");
    }

    await updateDeploymentStatus(deploymentId, "BUILDING", "Instalando dependencias...");
    
    // Instalar dependencias
    await execAsync("npm ci --legacy-peer-deps", { cwd: tmpDir });

    // Build del proyecto
    try {
      await execAsync("npm run build", { cwd: tmpDir });
    } catch (buildError) {
      // Intentar con next build si falla npm run build
      await execAsync("npx next build", { cwd: tmpDir });
    }

    await updateDeploymentStatus(deploymentId, "DEPLOYING", "Desplegando en Netlify...");
    
    const netlifyToken = env.NETLIFY_TOKEN || process.env.NETLIFY_TOKEN;
    if (!netlifyToken) {
      throw new Error("NETLIFY_TOKEN no configurado");
    }

    // Determinar el directorio de build
    let buildDir = "dist";
    try {
      await fs.access(path.join(tmpDir, ".next"));
      buildDir = ".next";
    } catch {
      try {
        await fs.access(path.join(tmpDir, "build"));
        buildDir = "build";
      } catch {
        // Usar dist por defecto
      }
    }

    const deployCommand = [
      "npx netlify deploy",
      "--prod",
      `--dir=${buildDir}`,
      `--auth=${netlifyToken}`,
      `--site=${subdomain}`,
    ].join(" ");

    const { stdout } = await execAsync(deployCommand, { 
      cwd: tmpDir,
      env: { ...process.env, NETLIFY_AUTH_TOKEN: netlifyToken }
    });

    // Extraer URL del output
    const urlMatch = stdout.match(/https:\/\/[^\s]+\.netlify\.app/);
    const deployUrl = urlMatch ? urlMatch[0] : null;

    if (!deployUrl) {
      throw new Error("No se pudo obtener la URL del deployment");
    }

    await updateDeploymentStatus(deploymentId, "READY", "Deploy completado exitosamente", deployUrl);

  } catch (error: any) {
    await updateDeploymentStatus(deploymentId, "FAILED", `Error: ${error.message}`);
    throw error;
  } finally {
    // Limpiar directorio temporal
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Función helper para actualizar estado del deployment
async function updateDeploymentStatus(
  deploymentId: string,
  status: "PENDING" | "BUILDING" | "DEPLOYING" | "READY" | "FAILED" | "CANCELLED",
  logs: string,
  deployUrl?: string
) {
  const { db } = await import("@/server/db");
  
  const updateData: any = {
    status,
    logs,
    updatedAt: new Date(),
  };

  if (deployUrl) updateData.deployUrl = deployUrl;
  if (status === "BUILDING") updateData.buildStartedAt = new Date();
  if (["READY", "FAILED", "CANCELLED"].includes(status)) updateData.finishedAt = new Date();

  await db.deployment.update({
    where: { id: deploymentId },
    data: updateData,
  });
}
