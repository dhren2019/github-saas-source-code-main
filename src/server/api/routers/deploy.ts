import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { Octokit } from "octokit";
import { env } from "@/env";

export const deployRouter = createTRPCRouter({
  // Crear un nuevo deploy
  createDeploy: protectedProcedure
    .input(z.object({ 
      projectId: z.string(),
      branch: z.string().default("main"),
      envVars: z.record(z.string()).optional(),
      deploymentType: z.enum(["preview", "production"]).default("preview")
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
        },
      });

      // Disparar GitHub Action para deploy
      try {
        const octokit = new Octokit({
          auth: env.GITHUB_TOKEN || process.env.GITHUB_APP_TOKEN,
        });

        await octokit.rest.actions.createWorkflowDispatch({
          owner,
          repo,
          workflow_id: "deploy.yml",
          ref: input.branch,
          inputs: {
            deploymentId: deployment.id,
            subdomain,
            envVars: JSON.stringify(input.envVars || {}),
            deploymentType: input.deploymentType.toUpperCase(),
            callbackUrl: `${env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/deploy/callback`,
          },
        });

        return {
          deploymentId: deployment.id,
          subdomain: `${subdomain}.deploys.dionysus.dev`,
          status: "PENDING",
        };
      } catch (error) {
        // Marcar deploy como fallido si no se puede disparar
        await ctx.db.deployment.update({
          where: { id: deployment.id },
          data: { status: "FAILED", errorMessage: String(error) },
        });
        
        throw new Error("Error al iniciar el deploy: " + String(error));
      }
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
