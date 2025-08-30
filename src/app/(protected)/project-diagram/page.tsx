"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  MarkerType,
  Edge,
  Node,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import axios from "axios";
import dagre from "dagre";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import useProject from "@/hooks/use-project";
import { api } from "@/trpc/react";

const nodeWidth = 180;
const nodeHeight = 40;

// Color scheme for different file types
const getNodeColor = (type: string) => {
  switch (type) {
    case 'page': return '#3b82f6'; // blue
    case 'api': return '#10b981'; // green  
    case 'component': return '#f59e0b'; // yellow
    case 'hook': return '#8b5cf6'; // purple
    case 'utility': return '#06b6d4'; // cyan
    case 'server': return '#ef4444'; // red
    default: return '#6b7280'; // gray
  }
};

function applyDagreLayout(nodes: Node[], edges: Edge[], rankdir: 'TB' | 'LR' = 'TB') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ 
    rankdir: rankdir, 
    ranker: "network-simplex", 
    ranksep: 60, 
    edgesep: 20,
    nodesep: 30
  });

  nodes.forEach((n) => g.setNode(n.id, { width: nodeWidth, height: nodeHeight }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  const positioned = nodes.map((n) => {
    const nodeWithPos = g.node(n.id);
    return {
      ...n,
      position: { 
        x: (nodeWithPos.x || 0) - nodeWidth / 2, 
        y: (nodeWithPos.y || 0) - nodeHeight / 2 
      }
    };
  });
  return positioned;
}

interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    folder: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
  }>;
  total: {
    nodes: number;
    edges: number;
  };
}

export default function ProjectDiagramPage() {
  const { projects, projectId, setProjectId } = useProject();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [stats, setStats] = useState<{ nodes: number; edges: number } | null>(null);

  // Orientation: TB = top->bottom (vertical), LR = left->right (horizontal)
  const [orientation, setOrientation] = useState<'TB' | 'LR'>('TB');

  // React Flow instance for programmatic zoom / fit
  const [rfInstance, setRfInstance] = useState<any | null>(null);

  // Filter UI
  const fileTypes = [
    { type: 'page', label: 'Pages', color: getNodeColor('page') },
    { type: 'api', label: 'API', color: getNodeColor('api') },
    { type: 'component', label: 'Components', color: getNodeColor('component') },
    { type: 'hook', label: 'Hooks', color: getNodeColor('hook') },
    { type: 'utility', label: 'Utils', color: getNodeColor('utility') },
    { type: 'server', label: 'Server', color: getNodeColor('server') },
    { type: 'other', label: 'Other', color: getNodeColor('other') },
  ];

  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(() => new Set(fileTypes.map(f => f.type)));
  const [showMore, setShowMore] = useState(false);

  // Keep local selectedProjectId in sync with the global projectId
  useEffect(() => {
    if (projectId && projectId !== selectedProjectId) {
      setSelectedProjectId(projectId);
    }
    // if there is no projectId globally, clear local selection
    if (!projectId) {
      setSelectedProjectId(null);
    }
  }, [projectId]);

  // Close the expanded 'Más' panel when switching projects to avoid stale UI
  useEffect(() => {
    setShowMore(false);
  }, [selectedProjectId]);

  const loadGraph = useCallback(async () => {
    if (!selectedProjectId) return;
    
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const { data }: { data: GraphData } = await axios.get(`/api/graph?projectId=${selectedProjectId}`);
      if ((data as any).warning) setWarning((data as any).warning);
      
      const rfNodes: Node[] = data.nodes.map((n) => ({
        id: n.id,
        type: 'default',
        data: { 
          label: n.label,
          type: n.type,
          folder: n.folder
        },
        position: { x: 0, y: 0 },
        style: {
          padding: "8px 12px",
          borderRadius: 8,
          background: getNodeColor(n.type),
          color: "white",
          border: "2px solid rgba(255,255,255,0.2)",
          fontSize: 11,
          fontWeight: 500,
          minWidth: 120,
          height: nodeHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        },
      }));

      const rfEdges: Edge[] = data.edges.map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { 
          stroke: "#64748b", 
          strokeWidth: 1.5,
          strokeOpacity: 0.6
        },
      }));

      const positioned = applyDagreLayout(rfNodes, rfEdges, orientation);
      setNodes(positioned);
      setEdges(rfEdges);
      setStats(data.total);

      // after nodes are positioned, ensure view fits
      setTimeout(() => {
        if (rfInstance?.fitView) {
          rfInstance.fitView({ padding: 0.1 });
        }
      }, 100);

    } catch (err: any) {
      // safer logging: prefer response.data when available, fallback to message or stringified object
      try {
        if (err?.response?.data) {
          console.error('loadGraph error response.data:', err.response.data);
        } else if (err?.message) {
          console.error('loadGraph error message:', err.message, err);
        } else {
          console.error('loadGraph error', err);
        }
      } catch (logErr) {
        console.error('loadGraph logging failed', logErr, err);
      }

      const serverError = (err && err.response && err.response.data && (err.response.data.error || err.response.data.message)) || err?.message || "Failed to load graph";
      setError(serverError);
      try { if (err?.response?.data?.warning) setWarning(err.response.data.warning); } catch (_) {}
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, orientation, rfInstance]);

  useEffect(() => {
    if (selectedProjectId) {
      loadGraph();
    }
  }, [loadGraph, selectedProjectId]);

  const selectedProject = projects?.find(p => p.id === selectedProjectId);

  // Filter nodes/edges based on selectedTypes
  const filteredNodes = useMemo(() => {
    return nodes.filter(n => {
      const t = (n.data && (n.data as any).type) || n.type || 'other';
      return selectedTypes.has(String(t));
    });
  }, [nodes, selectedTypes]);

  const visibleIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    return edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
  }, [edges, visibleIds]);

  const toggleType = (t: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  // Refit view when visible nodes change so diagram recenters after filtering
  useEffect(() => {
    if (!rfInstance) return;
    // run on next tick to allow React Flow to update
    const t = setTimeout(() => {
      try { rfInstance.fitView?.({ padding: 0.1 }); } catch (e) { /* ignore */ }
    }, 120);
    return () => clearTimeout(t);
  }, [filteredNodes, rfInstance]);

  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              Project Diagram
            </h1>
            
            {/* Project Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 dark:text-slate-400">Project:</label>
              <Select 
                value={selectedProjectId || ""} 
                onValueChange={(val) => {
                  const newId = val || null;
                  setSelectedProjectId(newId);
                  try {
                    // persist selection so other parts of the app update too
                    setProjectId(val || '');
                  } catch (e) {
                    console.warn('Failed to persist project selection', e);
                  }
                  // close expanded panel when switching projects
                  setShowMore(false);
                  // ensure the graph reloads for the newly selected project
                  setTimeout(() => {
                    try {
                      // call loadGraph if available
                      // eslint-disable-next-line @typescript-eslint/no-floating-promises
                      (async () => { if (newId) await loadGraph(); })();
                    } catch (e) {
                      console.warn('Failed to reload graph after project change', e);
                    }
                  }, 80);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={loadGraph} 
              disabled={loading || !selectedProjectId}
              variant="outline"
              size="sm"
            >
              {loading ? "Analyzing..." : "Refresh"}
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            {stats && (
              <div className="flex gap-2">
                <Badge variant="secondary">{stats.nodes} files</Badge>
                <Badge variant="secondary">{stats.edges} dependencies</Badge>
              </div>
            )}
            
            {/* Interactive File Types filter in header */}
            <Card className="p-3 hidden md:block">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium">File Types</div>
                <div className="text-xs text-slate-400">Mostrar</div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {fileTypes.map(({ type, label, color }) => (
                  <label key={type} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selectedTypes.has(type)}
                      onChange={() => toggleType(type)}
                      className="w-4 h-4"
                    />
                    <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: color }} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </Card>
          </div>
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950 border-t border-red-200 dark:border-red-800">
            <span className="text-red-600 dark:text-red-400 text-sm">
              Error: {error}
            </span>
          </div>
        )}
      </div>

      {/* Flow - container relative so we can overlay controls at bottom */}
      <div style={{ height: "calc(100vh - 120px)", width: "100%" }} className="relative">
        <ReactFlowProvider>
          <ReactFlow 
            nodes={filteredNodes} 
            edges={filteredEdges} 
            fitView 
            nodesDraggable={true}
            elementsSelectable={true}
            defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
            minZoom={0.1}
            maxZoom={2}
            className="bg-slate-50 dark:bg-slate-950"
            onInit={(instance) => setRfInstance(instance)}
          >
            <MiniMap 
              nodeStrokeColor={() => "#334155"} 
              nodeColor="#6b7280"
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <Controls className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg" />
            <Background 
              gap={20} 
              size={1} 
              color="#e2e8f0" 
              className="dark:opacity-20"
            />
          </ReactFlow>

          {/* Small circular button bottom-left that expands options upward */}
          <div className="absolute left-4 bottom-4 z-30">
            <button
              onClick={() => setShowMore(v => !v)}
              aria-label="Abrir opciones del diagrama"
              className="w-10 h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-md flex items-center justify-center text-xl"
            >
              {showMore ? '×' : '+'}
            </button>

            {showMore && (
              <Card className="mt-2 mb-10 w-72 p-3 shadow-lg">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Opciones del diagrama</div>
                    <div className="text-xs text-slate-500">{selectedProject?.name || ''}</div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => rfInstance?.zoomIn?.()}>Zoom +</Button>
                    <Button size="sm" onClick={() => rfInstance?.zoomOut?.()}>Zoom -</Button>
                    <Button size="sm" onClick={() => rfInstance?.fitView?.({ padding: 0.1 })}>Fit</Button>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant={orientation === 'TB' ? 'default' : 'outline'} onClick={() => { setOrientation('TB'); setTimeout(() => loadGraph(), 80); }}>Vertical</Button>
                    <Button size="sm" variant={orientation === 'LR' ? 'default' : 'outline'} onClick={() => { setOrientation('LR'); setTimeout(() => loadGraph(), 80); }}>Horizontal</Button>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Filtrar tipos</div>
                    <div className="flex flex-col gap-2 max-h-40 overflow-auto">
                      {fileTypes.map(({ type, label, color }) => (
                        <label key={type} className="flex items-center gap-2">
                          <Checkbox checked={selectedTypes.has(type)} onCheckedChange={() => toggleType(type)} />
                          <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: color }} />
                          <span className="text-sm">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Button size="sm" onClick={() => {
                      const payload = {
                        projectId: selectedProjectId,
                        exportedAt: new Date().toISOString(),
                        nodes: filteredNodes.map(n => ({ id: n.id, label: (n.data as any)?.label, type: (n.data as any)?.type, position: n.position })),
                        edges: filteredEdges.map(e => ({ source: e.source, target: e.target }))
                      };
                      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${selectedProject?.name || 'diagram'}-export.json`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    }}>Exportar</Button>

                    <Button size="sm" variant="ghost" onClick={() => setShowMore(false)}>Cerrar</Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
