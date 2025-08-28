import { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/server/db";

// API route para recibir callbacks de GitHub Actions
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      deploymentId,
      status,
      logs,
      deployUrl,
      errorMessage,
      commitHash,
      workflowRunId,
      workflowRunUrl,
    } = req.body;

    if (!deploymentId) {
      return res.status(400).json({ error: "deploymentId is required" });
    }

    // Buscar el deployment
    const deployment = await db.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment) {
      return res.status(404).json({ error: "Deployment not found" });
    }

    // Actualizar el deployment con los nuevos datos
    const updateData: any = {
      status: status || deployment.status,
      updatedAt: new Date(),
    };

    if (logs) updateData.logs = logs;
    if (deployUrl) updateData.deployUrl = deployUrl;
    if (errorMessage) updateData.errorMessage = errorMessage;
    if (commitHash) updateData.commitHash = commitHash;
    if (workflowRunId) updateData.workflowRunId = workflowRunId;
    if (workflowRunUrl) updateData.workflowRunUrl = workflowRunUrl;

    // Si el status es BUILDING y no tenemos buildStartedAt, marcarlo
    if (status === "BUILDING" && !deployment.buildStartedAt) {
      updateData.buildStartedAt = new Date();
    }

    // Si el status es final (READY, FAILED, CANCELLED), marcar finishedAt
    if (["READY", "FAILED", "CANCELLED"].includes(status) && !deployment.finishedAt) {
      updateData.finishedAt = new Date();
    }

    await db.deployment.update({
      where: { id: deploymentId },
      data: updateData,
    });

    // Si es un deploy exitoso, crear/actualizar registro DNS
    if (status === "READY" && deployUrl) {
      await createSubdomainRecord(deployment.subdomain, deployUrl);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in deploy callback:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Función para crear registro DNS (usando Cloudflare como ejemplo)
async function createSubdomainRecord(subdomain: string, targetUrl: string) {
  const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
  const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

  if (!CLOUDFLARE_ZONE_ID || !CLOUDFLARE_API_TOKEN) {
    console.warn("Cloudflare credentials not configured, skipping DNS creation");
    return;
  }

  try {
    // Extraer el hostname del target URL
    const targetHost = new URL(targetUrl).hostname;
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "CNAME",
          name: `${subdomain}.deploys`,
          content: targetHost,
          ttl: 300, // 5 minutos
          proxied: false,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Error creating DNS record:", error);
    } else {
      console.log(`DNS record created for ${subdomain}.deploys.dionysus.dev -> ${targetHost}`);
    }
  } catch (error) {
    console.error("Error creating DNS record:", error);
  }
}
