import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { Octokit } from "octokit";
import { env } from "@/env";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { db } from "@/server/db";

const execAsync = promisify(exec);

// Cast Prisma client to `any` to avoid TS errors when generated client types are out-of-sync in dev.
const prisma: any = db;

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
      const userProject = await prisma.userToProject.findFirst({
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
      const deployment = await prisma.deployment.create({
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
          // Prisma enum expects uppercase values (VERCEL / NETLIFY)
          provider: (input.provider as string).toUpperCase(),
        },
      });

      // Ejecutar deploy según el provider seleccionado
      if (input.provider === "vercel") {
        deployWithVercel(deployment.id, project.githubUrl, input.branch, input.envVars || {}, subdomain)
          .catch(async (error) => {
            // Guardar error tanto en logs (updateDeploymentStatus) como en errorMessage
            try {
              await updateDeploymentStatus(deployment.id, "FAILED", `Error: ${error?.message || String(error)}`);
            } catch (e) {
              // fallback: set errorMessage directly
              await prisma.deployment.update({ where: { id: deployment.id }, data: { status: "FAILED", errorMessage: String(error?.message || error) } });
            }
          });
      } else if (input.provider === "netlify") {
        deployWithNetlify(deployment.id, project.githubUrl, input.branch, input.envVars || {}, subdomain)
          .catch(async (error) => {
            try {
              await updateDeploymentStatus(deployment.id, "FAILED", `Error: ${error?.message || String(error)}`);
            } catch (e) {
              await prisma.deployment.update({ where: { id: deployment.id }, data: { status: "FAILED", errorMessage: String(error?.message || error) } });
            }
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
      const deployment = await prisma.deployment.findUnique({
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
      const hasAccess = await prisma.userToProject.findFirst({
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
      const hasAccess = await prisma.userToProject.findFirst({
        where: {
          userId: ctx.user.userId!,
          projectId: input.projectId,
        },
      });

      if (!hasAccess) {
        throw new Error("No tienes acceso a este proyecto");
      }

      return await prisma.deployment.findMany({
        where: { projectId: input.projectId },
        include: {
          user: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20, // Limitar a los últimos 20 deploys
      });
    }),

  // Obtener ramas del repositorio del proyecto
  getRepoBranches: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verificar acceso
      const hasAccess = await prisma.userToProject.findFirst({
        where: {
          userId: ctx.user.userId!,
          projectId: input.projectId,
        },
      });

      if (!hasAccess) {
        throw new Error("No tienes acceso a este proyecto");
      }

      const project = await prisma.project.findUnique({ where: { id: input.projectId } });
      if (!project || !project.githubUrl) return [];

      const cleaned = project.githubUrl.replace("https://github.com/", "").replace(/\.git$/, "");
      const [owner, repo] = cleaned.split("/");
      if (!owner || !repo) return [];

      const token = env.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
      if (!token) return [];

      try {
        const octokit = new Octokit({ auth: token });
        const resp = await octokit.rest.repos.listBranches({ owner, repo, per_page: 100 });
        return resp.data.map((b) => b.name);
      } catch (error) {
        console.error("Error obteniendo ramas de GitHub:", error);
        return [];
      }
    }),

  // Obtener logs de un deploy
  getDeploymentLogs: protectedProcedure
    .input(z.object({ deploymentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const deployment = await prisma.deployment.findUnique({
        where: { id: input.deploymentId },
      });

      if (!deployment) {
        throw new Error("Deploy no encontrado");
      }

      // Verificar acceso
      const hasAccess = await prisma.userToProject.findFirst({
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
          
          // Buscar workflow runs recientes (sin especificar workflow específico)
          try {
            const runs = await octokit.rest.actions.listWorkflowRunsForRepo({
              owner: deployment.githubOwner,
              repo: deployment.githubRepo,
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
          } catch (workflowError) {
            // Si no hay workflows, no es un error crítico
            console.log("No workflow runs found or no access to GitHub Actions for this repo");
          }
        } catch (error) {
          console.error("Error obteniendo logs de GitHub:", error);
        }
      }

      return {
        // Mostrar logs; si no hay logs, mostrar errorMessage cuando exista
        logs: deployment.logs || deployment.errorMessage || "Logs no disponibles",
        githubRunUrl: null,
        githubStatus: null,
        githubConclusion: null,
      };
    }),

  // Cancelar un deploy
  cancelDeployment: protectedProcedure
    .input(z.object({ deploymentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deployment = await prisma.deployment.findUnique({
        where: { id: input.deploymentId },
      });

      if (!deployment) {
        throw new Error("Deploy no encontrado");
      }

      // Verificar acceso y que el deploy esté en progreso
      const hasAccess = await prisma.userToProject.findFirst({
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
      await prisma.deployment.update({
        where: { id: input.deploymentId },
        data: { 
          status: "CANCELLED",
          finishedAt: new Date(),
        },
      });

      return { success: true };
    }),

  // Verificar status de servidor (para el badge)
  checkServerStatus: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .query(async ({ input }) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(input.url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': 'GitHub-SaaS-StatusChecker/1.0',
          },
        });
        
        clearTimeout(timeoutId);
        
        return {
          status: response.ok ? 'online' : 'offline',
          statusCode: response.status,
          checkedAt: new Date().toISOString(),
        };
      } catch (error) {
        console.log(`Server status check failed for ${input.url}:`, error);
        return {
          status: 'offline' as const,
          statusCode: 0,
          checkedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),
});

// Función para deploy con Vercel (usando REST API en lugar de CLI)
async function deployWithVercel(
  deploymentId: string,
  repoUrl: string,
  branch: string,
  envVars: Record<string, string>,
  subdomain: string
) {
  try {
    await updateDeploymentStatus(deploymentId, "BUILDING", "Preparando deploy en Vercel...");

    const vercelToken = env.VERCEL_TOKEN || process.env.VERCEL_TOKEN;
    if (!vercelToken) {
      throw new Error("VERCEL_TOKEN no configurado");
    }

    // Extraer owner/repo del URL y limpiar
    console.log(`Original repo URL: ${repoUrl}`);
    const cleaned = repoUrl.replace("https://github.com/", "").replace(/\.git$/, "").trim();
    const [owner, repo] = cleaned.split("/");
    console.log(`Parsed owner: ${owner}, repo: ${repo}`);
    
    if (!owner || !repo) {
      throw new Error(`URL de GitHub inválida para Vercel. Parsed: owner="${owner}", repo="${repo}"`);
    }

    // Verificar que el repo existe en GitHub y obtener su ID
    await updateDeploymentStatus(deploymentId, "BUILDING", "Verificando repositorio GitHub...");
    
    let githubRepoId: number | undefined;
    const githubToken = env.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
    if (githubToken) {
      try {
        const githubCheckRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            "User-Agent": "GitHub-SaaS-Deploy/1.0",
          },
        });
        
        if (!githubCheckRes.ok) {
          console.log(`GitHub repo check failed: ${githubCheckRes.status}`);
          const errorData = await githubCheckRes.text();
          console.log(`GitHub repo check error:`, errorData);
          
          if (githubCheckRes.status === 404) {
            throw new Error(`Repositorio ${owner}/${repo} no encontrado. Verifica que el repositorio existe y que tienes acceso a él.`);
          } else if (githubCheckRes.status === 403) {
            throw new Error(`Sin permisos para acceder al repositorio ${owner}/${repo}. Verifica los permisos del token de GitHub.`);
          } else {
            throw new Error(`Error ${githubCheckRes.status} accediendo al repositorio GitHub ${owner}/${repo}.`);
          }
        }
        
        const repoData = await githubCheckRes.json();
        githubRepoId = repoData.id;
        console.log(`GitHub repo verified: ${repoData.full_name}, ID: ${githubRepoId}, private: ${repoData.private}`);
      } catch (githubError: any) {
        console.error("GitHub verification failed:", githubError);
        throw new Error(`Error verificando repositorio en GitHub: ${githubError.message}`);
      }
    }

    // Verificar si Vercel ya tiene este proyecto vinculado
    await updateDeploymentStatus(deploymentId, "BUILDING", "Verificando integración con Vercel...");
    
    let vercelRepoId: string | number | undefined;
    let existingProject: any = null;
    
    try {
      const vercelProjectsRes = await fetch("https://api.vercel.com/v9/projects", {
        headers: {
          Authorization: `Bearer ${vercelToken}`,
        },
      });
      
      if (vercelProjectsRes.ok) {
        const projectsData = await vercelProjectsRes.json();
        existingProject = projectsData.projects?.find((p: any) => 
          p.link?.repo === repo && p.link?.org === owner
        );
        
        if (existingProject) {
          console.log(`Found existing Vercel project: ${existingProject.name}, id: ${existingProject.id}`);
          vercelRepoId = existingProject.link.repoId;
          
          // Usar el proyecto existente para crear un deployment
          const deploymentBody: any = {
            name: subdomain,
            target: branch === "main" || branch === "master" ? "production" : "preview",
            gitSource: {
              type: "github",
              repoId: existingProject.link.repoId, // Usar el repoId del proyecto existente
              ref: branch,
            },
          };

          // Añadir env vars si existen
          if (Object.keys(envVars).length > 0) {
            deploymentBody.env = envVars;
          }

          console.log(`Using existing project for deployment:`, JSON.stringify(deploymentBody, null, 2));

          await updateDeploymentStatus(deploymentId, "DEPLOYING", "Creando deployment con proyecto existente...");

          const deployRes = await fetch(`https://api.vercel.com/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${vercelToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(deploymentBody),
          });

          const deployData = await deployRes.json();
          console.log(`Deployment response status: ${deployRes.status}`);
          console.log(`Deployment response:`, JSON.stringify(deployData, null, 2));
          
          if (!deployRes.ok) {
            const message = deployData?.error?.message || deployData?.message || JSON.stringify(deployData);
            console.log(`Existing project deployment failed, trying to create new project...`);
            // No hacemos throw aquí, intentamos crear un proyecto nuevo
          } else {
            const deployUrl = deployData.url ? `https://${deployData.url}` : deployData.deploymentUrl || null;
            if (deployUrl) {
              await updateDeploymentStatus(deploymentId, "READY", "Deploy completado exitosamente", deployUrl);
              return;
            }
          }
        }
      }
    } catch (vercelCheckError) {
      console.log("Could not verify existing Vercel projects, proceeding with new deployment...");
    }

    // Si no hay proyecto existente, crear deployment directo
    await updateDeploymentStatus(deploymentId, "DEPLOYING", "Creando deployment directo en Vercel...");

    const target = branch === "main" || branch === "master" ? "production" : "preview";

    const deploymentBody: any = {
      name: subdomain,
      target,
      gitSource: {
        type: "github",
        repoId: githubRepoId, // Usar el ID numérico del repo
        ref: branch,
      },
    };

    // Añadir env vars si existen
    if (Object.keys(envVars).length > 0) {
      deploymentBody.env = envVars;
    }

    console.log(`Creating direct deployment:`, JSON.stringify(deploymentBody, null, 2));

    const deployRes = await fetch(`https://api.vercel.com/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(deploymentBody),
    });

    const deployData = await deployRes.json();
    console.log(`Deployment response status: ${deployRes.status}`);
    console.log(`Deployment response:`, JSON.stringify(deployData, null, 2));
    
    if (!deployRes.ok) {
      const message = deployData?.error?.message || deployData?.message || JSON.stringify(deployData);
      
      // Proveer mensajes más específicos para casos comunes
      if (message.includes("repository") && message.includes("not found")) {
        await updateDeploymentStatus(deploymentId, "FAILED", `Repositorio no encontrado en Vercel. El repositorio ${owner}/${repo} necesita estar conectado a tu cuenta de Vercel.`);
        throw new Error(`El repositorio ${owner}/${repo} no está conectado a Vercel. Para solucionarlo:\n\n1. Ve a https://vercel.com/new\n2. Conecta tu cuenta de GitHub si no lo has hecho\n3. Autoriza acceso al repositorio ${owner}/${repo}\n4. Vuelve a intentar el deploy`);
      } else if (message.includes("permission") || message.includes("access") || message.includes("forbidden")) {
        await updateDeploymentStatus(deploymentId, "FAILED", `Sin permisos para el repositorio. Verifica que la app de Vercel tenga acceso al repositorio ${owner}/${repo}.`);
        throw new Error(`Sin permisos para acceder al repositorio ${owner}/${repo} desde Vercel. Asegúrate de que la Vercel GitHub App tenga permisos de acceso a este repositorio.`);
      } else {
        await updateDeploymentStatus(deploymentId, "FAILED", `Error en deployment: ${message}`);
        throw new Error(`Vercel deployment failed: ${message}`);
      }
    }

    const deployUrl = deployData.url ? `https://${deployData.url}` : deployData.deploymentUrl || null;
    if (!deployUrl) {
      await updateDeploymentStatus(deploymentId, "FAILED", "No se obtuvo URL del deployment desde Vercel");
      throw new Error("No se pudo obtener la URL del deployment");
    }

    await updateDeploymentStatus(deploymentId, "READY", "Deploy completado exitosamente", deployUrl);
  } catch (error: any) {
    console.error(`Vercel deployment error:`, error);
    await updateDeploymentStatus(deploymentId, "FAILED", `Error: ${error.message}`);
    throw error;
  }
}

// Función para deploy con Netlify (usar Build Hook o API en lugar de CLI)
async function deployWithNetlify(
  deploymentId: string,
  repoUrl: string,
  branch: string,
  envVars: Record<string, string>,
  subdomain: string
) {
  try {
    await updateDeploymentStatus(deploymentId, "BUILDING", "Preparando deploy en Netlify...");

    // Preferir Build Hook si está configurado en env
    const netlifyBuildHook = process.env.NETLIFY_BUILD_HOOK;
    const netlifyToken = process.env.NETLIFY_TOKEN;
    const netlifySiteId = process.env.NETLIFY_SITE_ID;

    if (netlifyBuildHook) {
      await updateDeploymentStatus(deploymentId, "DEPLOYING", "Triggering Netlify Build Hook...");

      const res = await fetch(netlifyBuildHook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ branch }),
      });

      if (!res.ok) {
        const text = await res.text();
        await updateDeploymentStatus(deploymentId, "FAILED", `Netlify Build Hook failed: ${res.status} ${text}`);
        throw new Error(`Netlify build hook failed: ${res.status} ${text}`);
      }

      // Build hooks don't always return the deploy URL immediately
      await updateDeploymentStatus(deploymentId, "DEPLOYING", "Netlify build triggered; esperando URL...");
      await updateDeploymentStatus(deploymentId, "READY", "Build triggered en Netlify; revisa Netlify para el estado");
      return;
    }

    // Si no hay build hook intentar usar la API para crear un build
    if (netlifyToken && netlifySiteId) {
      await updateDeploymentStatus(deploymentId, "DEPLOYING", "Creando build via Netlify API...");

      const res = await fetch(`https://api.netlify.com/api/v1/sites/${netlifySiteId}/builds`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${netlifyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ branch }),
      });

      const data = await res.json();
      if (!res.ok) {
        const message = data?.message || JSON.stringify(data);
        await updateDeploymentStatus(deploymentId, "FAILED", `Netlify API error: ${message}`);
        throw new Error(`Netlify deploy failed: ${message}`);
      }

      const deployUrl = data?.deploy_url || data?.deploy?.url || null;
      if (deployUrl) {
        await updateDeploymentStatus(deploymentId, "READY", "Deploy completado en Netlify", deployUrl);
      } else {
        await updateDeploymentStatus(deploymentId, "DEPLOYING", "Build creado en Netlify; revisa Netlify para el estado");
      }

      return;
    }

    throw new Error("No se encontró configuración de Netlify (BUILD_HOOK o SITE_ID + TOKEN)");
  } catch (error: any) {
    await updateDeploymentStatus(deploymentId, "FAILED", `Error: ${error.message}`);
    throw error;
  }
}

// Función helper para actualizar estado del deployment
async function updateDeploymentStatus(
  deploymentId: string,
  status: "PENDING" | "BUILDING" | "DEPLOYING" | "READY" | "FAILED" | "CANCELLED",
  logs: string,
  deployUrl?: string
) {
  const updateData: any = {
     status,
     logs,
     updatedAt: new Date(),
   };

   if (deployUrl) updateData.deployUrl = deployUrl;
   if (status === "BUILDING") updateData.buildStartedAt = new Date();
   if (["READY", "FAILED", "CANCELLED"].includes(status)) updateData.finishedAt = new Date();

  await prisma.deployment.update({
    where: { id: deploymentId },
    data: updateData,
  });
}
