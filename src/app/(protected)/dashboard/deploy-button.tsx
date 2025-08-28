"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import useProject from "@/hooks/use-project";
import { api } from "@/trpc/react";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Rocket, 
  GitBranch, 
  Settings, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  ExternalLink,
  Copy,
  Eye,
  Trash2
} from "lucide-react";

const DeployButton = () => {
  const { project } = useProject();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [branch, setBranch] = useState("main");
  const [deploymentType, setDeploymentType] = useState<"preview" | "production">("preview");
  const [provider, setProvider] = useState<"vercel" | "netlify">("vercel");
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [envVarInput, setEnvVarInput] = useState("");
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);

  // Mutations
  const createDeploy = api.deploy.createDeploy.useMutation({
    onSuccess: (data) => {
      toast.success(`Deploy iniciado! Subdomain: ${data.subdomain}`);
      setIsDialogOpen(false);
      refetchDeployments();
    },
    onError: (error) => {
      toast.error(`Error al iniciar deploy: ${error.message}`);
    },
  });

  const cancelDeployment = api.deploy.cancelDeployment.useMutation({
    onSuccess: () => {
      toast.success("Deploy cancelado");
      refetchDeployments();
    },
    onError: (error) => {
      toast.error(`Error al cancelar: ${error.message}`);
    },
  });

  // Queries
  const { data: deployments, refetch: refetchDeployments } = api.deploy.getProjectDeployments.useQuery(
    { projectId: project?.id || "" },
    { enabled: !!project?.id, refetchInterval: 5000 }
  );

  const { data: selectedDeploymentData } = api.deploy.getDeployment.useQuery(
    { deploymentId: selectedDeployment || "" },
    { enabled: !!selectedDeployment, refetchInterval: 3000 }
  );

  const { data: deploymentLogs } = api.deploy.getDeploymentLogs.useQuery(
    { deploymentId: selectedDeployment || "" },
    { enabled: !!selectedDeployment }
  );

  const handleDeploy = () => {
    if (!project?.id) {
      toast.error("No hay proyecto seleccionado");
      return;
    }

    createDeploy.mutate({
      projectId: project.id,
      branch,
      deploymentType,
      provider,
      envVars: Object.keys(envVars).length > 0 ? envVars : undefined,
    });
  };

  const handleAddEnvVar = () => {
    const lines = envVarInput.split('\n').filter(line => line.trim());
    const newEnvVars = { ...envVars };
    
    lines.forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        newEnvVars[key.trim()] = valueParts.join('=').trim();
      }
    });
    
    setEnvVars(newEnvVars);
    setEnvVarInput("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "READY": return "bg-green-500";
      case "BUILDING": case "DEPLOYING": return "bg-yellow-500";
      case "FAILED": return "bg-red-500";
      case "CANCELLED": return "bg-gray-500";
      default: return "bg-blue-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "READY": return <CheckCircle className="h-4 w-4" />;
      case "BUILDING": case "DEPLOYING": return <RefreshCw className="h-4 w-4 animate-spin" />;
      case "FAILED": return <XCircle className="h-4 w-4" />;
      case "CANCELLED": return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  };

  if (!project) {
    return null;
  }

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button className="bg-green-600 text-white hover:bg-green-700">
            <Rocket className="h-4 w-4 mr-2" />
            Deploy project
          </Button>
        </DialogTrigger>
        
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Deploy: {project.name}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Panel de configuración */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Configuración del Deploy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="branch">Branch</Label>
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="branch"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        placeholder="main"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="deployment-type">Tipo de Deploy</Label>
                    <Select value={deploymentType} onValueChange={(value: "preview" | "production") => setDeploymentType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preview">Preview</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="provider">Provider de Deploy</Label>
                    <Select value={provider} onValueChange={(value: "vercel" | "netlify") => setProvider(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vercel">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-black rounded"></div>
                            Vercel
                          </div>
                        </SelectItem>
                        <SelectItem value="netlify">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-teal-500 rounded"></div>
                            Netlify
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="env-vars">Variables de Entorno</Label>
                    <Textarea
                      id="env-vars"
                      value={envVarInput}
                      onChange={(e) => setEnvVarInput(e.target.value)}
                      placeholder="KEY=value&#10;ANOTHER_KEY=another_value"
                      rows={3}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={handleAddEnvVar}
                    >
                      Agregar Variables
                    </Button>
                  </div>

                  {Object.keys(envVars).length > 0 && (
                    <div>
                      <Label>Variables Configuradas:</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(envVars).map(([key, value]) => (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {key}
                            <button
                              onClick={() => {
                                const newEnvVars = { ...envVars };
                                delete newEnvVars[key];
                                setEnvVars(newEnvVars);
                              }}
                              className="ml-1 hover:text-red-500"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleDeploy}
                    disabled={createDeploy.isPending}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {createDeploy.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Iniciando Deploy...
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4 mr-2" />
                        Iniciar Deploy
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Panel de historial de deploys */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Historial de Deploys
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchDeployments()}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {deployments && deployments.length > 0 ? (
                      <div className="space-y-2">
                        {deployments.map((deployment) => (
                          <div
                            key={deployment.id}
                            className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer"
                            onClick={() => setSelectedDeployment(deployment.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(deployment.status)}
                                <span className="font-medium">{deployment.subdomain}</span>
                                <Badge variant={deployment.deploymentType === "production" ? "default" : "secondary"}>
                                  {deployment.deploymentType}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1">
                                {deployment.deployUrl && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(deployment.deployUrl!, '_blank');
                                    }}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(`https://${deployment.subdomain}.deploys.dionysus.dev`);
                                  }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                {["PENDING", "BUILDING"].includes(deployment.status) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      cancelDeployment.mutate({ deploymentId: deployment.id });
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                              <span>{deployment.branch}</span>
                              <span>{new Date(deployment.createdAt).toLocaleString()}</span>
                            </div>
                            <div className={`inline-block px-2 py-1 rounded text-xs text-white mt-2 ${getStatusColor(deployment.status)}`}>
                              {deployment.status}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No hay deploys aún
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Panel de detalles del deployment seleccionado */}
          {selectedDeployment && selectedDeploymentData && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Detalles del Deploy: {selectedDeploymentData.subdomain}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label>Status:</Label>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedDeploymentData.status)}
                      <span>{selectedDeploymentData.status}</span>
                    </div>
                  </div>
                  <div>
                    <Label>URL del Deploy:</Label>
                    {selectedDeploymentData.deployUrl ? (
                      <div className="flex items-center gap-2">
                        <a 
                          href={selectedDeploymentData.deployUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          {selectedDeploymentData.deployUrl}
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(selectedDeploymentData.deployUrl!)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No disponible aún</span>
                    )}
                  </div>
                </div>

                {deploymentLogs && (
                  <div>
                    <Label>Logs:</Label>
                    <ScrollArea className="h-32 w-full border rounded mt-2">
                      <pre className="p-3 text-xs">{deploymentLogs.logs || "No hay logs disponibles"}</pre>
                    </ScrollArea>
                    {deploymentLogs.githubRunUrl && (
                      <div className="mt-2">
                        <a 
                          href={deploymentLogs.githubRunUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline text-sm"
                        >
                          Ver logs completos en GitHub Actions
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DeployButton;
