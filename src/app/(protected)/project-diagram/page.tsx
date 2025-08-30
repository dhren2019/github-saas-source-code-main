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
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
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

  // File type definitions and filter state
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

  // Export format state (SVG / PNG / JPG / JSON)
  const [exportFormat, setExportFormat] = useState<'SVG' | 'PNG' | 'JPG' | 'JSON'>('SVG');

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

  // Persisted layout helpers: refs and debounce timer
  const nodesRef = React.useRef<Node[]>(nodes);
  const edgesRef = React.useRef<Edge[]>(edges);
  const saveTimer = React.useRef<number | null>(null);

  // Keep refs in sync with state so saveLayout reads latest
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const storageKeyFor = (projId?: string | null) => `diagram-layout-${projId || 'unknown'}`;

  const saveLayout = React.useCallback(() => {
    if (!selectedProjectId) return;
    try {
      const payload = {
        nodes: nodesRef.current.map(n => ({ id: n.id, position: (n.position as any) ?? null })),
        edges: edgesRef.current.map(e => ({ source: e.source, target: e.target })),
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKeyFor(selectedProjectId), JSON.stringify(payload));
      // console.log('Saved diagram layout', payload);
    } catch (e) {
      console.warn('Failed to save diagram layout', e);
    }
  }, [selectedProjectId]);

  const scheduleSave = React.useCallback(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveLayout();
      saveTimer.current = null;
    }, 900) as unknown as number;
  }, [saveLayout]);

  // Load saved layout (used when applying graph results)
  const loadSavedLayout = React.useCallback((projId?: string | null) => {
    if (!projId) return null;
    try {
      const raw = localStorage.getItem(storageKeyFor(projId));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }, []);

  // Handlers for interactive editing
  const onNodesChange = React.useCallback((changes: any) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    scheduleSave();
  }, [scheduleSave]);

  const onEdgesChange = React.useCallback((changes: any) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    scheduleSave();
  }, [scheduleSave]);

  const onConnect = React.useCallback((connection: any) => {
    setEdges((eds) => addEdge({ ...connection, id: `e-${Date.now()}`, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#64748b', strokeWidth: 1.5, strokeOpacity: 0.6 } }, eds));
    scheduleSave();
  }, [scheduleSave]);

  const onNodeDragStop = React.useCallback((_: any, node: Node) => {
    setNodes((nds) => nds.map(n => n.id === node.id ? { ...n, position: node.position } : n));
    scheduleSave();
  }, [scheduleSave]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, []);

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

      // If there's a saved layout for this project, merge positions instead of overwriting with dagre
      const saved = loadSavedLayout(selectedProjectId);
      let finalNodes: Node[];
      if (saved && Array.isArray(saved.nodes) && saved.nodes.length > 0) {
        // ensure positions have x/y numbers
        const posMap = new Map<string, { x: number; y: number } | null>(saved.nodes.map((s: any) => [String(s.id), s.position && typeof s.position.x === 'number' && typeof s.position.y === 'number' ? { x: s.position.x, y: s.position.y } : null]));
        finalNodes = rfNodes.map((n) => {
          const savedPos = posMap.get(n.id);
          if (savedPos) {
            return { ...n, position: { x: savedPos.x, y: savedPos.y } } as Node;
          }
          return n;
        });
      } else {
        // No saved layout -> apply dagre layout
        finalNodes = applyDagreLayout(rfNodes, rfEdges, orientation);
      }

      setNodes(finalNodes);
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
    <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header - fixed height */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
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
      </div>      {/* Flow - container that adapts to remaining viewport height */}
      <div className="flex-1 relative overflow-hidden">
        {/* Instruction text top-right */}
        <div 
          className="absolute top-4 right-4 bg-slate-800 text-white px-3 py-2 rounded-lg text-sm shadow-lg z-50"
          style={{ zIndex: 10000 }}
        >
          Scroll down to see all workflow
        </div>

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
            className="bg-slate-50 dark:bg-slate-950 w-full h-full"
            onInit={(instance) => setRfInstance(instance)}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
          >
            {/* MiniMap hidden to avoid cutting off */}
            {/* <MiniMap 
              nodeStrokeColor={() => "#334155"} 
              nodeColor="#6b7280"
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              style={{ bottom: 20, right: 80 }}
            /> */}
            <Controls 
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              style={{ bottom: 20, left: 20 }}
            />
            <Background 
              gap={20} 
              size={1} 
              color="#e2e8f0" 
              className="dark:opacity-20"
            />
          </ReactFlow>
        </ReactFlowProvider>

        {/* Styled Floating bubble button bottom-right */}
        <div className="absolute bottom-6 right-6" style={{ zIndex: 10000 }}>
          <div className="relative flex flex-col items-end">
            {/* Options that appear above the main button when expanded */}
            {showMore && (
              <div className="mb-3 flex flex-col gap-3 animate-in slide-in-from-bottom-2">
                <button
                  onClick={() => {
                    if (!rfInstance) {
                      alert('Diagram not ready for export');
                      return;
                    }
                    
                    // Create a temporary download based on format
                    const exportFormat = 'SVG'; // You can make this dynamic later
                    
                    if (exportFormat === 'SVG') {
                      // Build an SVG from the positioned nodes and edges so we don't rely on internal DOM structure
                      try {
                        const padding = 40;
                        // compute bounding box from filteredNodes
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        filteredNodes.forEach((n) => {
                          const x = (n.position as any)?.x ?? 0;
                          const y = (n.position as any)?.y ?? 0;
                          minX = Math.min(minX, x);
                          minY = Math.min(minY, y);
                          maxX = Math.max(maxX, x + nodeWidth);
                          maxY = Math.max(maxY, y + nodeHeight);
                        });

                        if (minX === Infinity) {
                          throw new Error('No nodes to export');
                        }

                        const width = Math.ceil(maxX - minX + padding * 2);
                        const height = Math.ceil(maxY - minY + padding * 2);

                        const nodeMap = new Map(filteredNodes.map((n) => [n.id, n] as const));

                        // helper to escape text
                        const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

                        let svg = `<?xml version="1.0" encoding="UTF-8"?>`;
                        svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

                        // defs: arrow marker
                        svg += `<defs>`;
                        svg += `<marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto">`;
                        svg += `<path d="M0,0 L10,5 L0,10 z" fill="#64748b" />`;
                        svg += `</marker>`;
                        svg += `</defs>`;

                        // optional background
                        const bgColor = document.documentElement.classList.contains('dark') ? '#0b1220' : '#ffffff';
                        svg += `<rect width="100%" height="100%" fill="${bgColor}" />`;

                        // render edges
                        filteredEdges.forEach((e) => {
                          const s = nodeMap.get(e.source as string) as Node | undefined;
                          const t = nodeMap.get(e.target as string) as Node | undefined;
                          if (!s || !t) return;
                          const sx = ((s.position as any)?.x ?? 0) - minX + nodeWidth / 2 + padding;
                          const sy = ((s.position as any)?.y ?? 0) - minY + nodeHeight / 2 + padding;
                          const tx = ((t.position as any)?.x ?? 0) - minX + nodeWidth / 2 + padding;
                          const ty = ((t.position as any)?.y ?? 0) - minY + nodeHeight / 2 + padding;

                          // simple straight line with arrow
                          svg += `<line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="#64748b" stroke-width="1.5" stroke-opacity="0.6" marker-end="url(#arrow)" />`;
                        });

                        // render nodes
                        filteredNodes.forEach((n) => {
                          const x = ((n.position as any)?.x ?? 0) - minX + padding;
                          const y = ((n.position as any)?.y ?? 0) - minY + padding;
                          const bg = (n.style && (n.style as any).background) || getNodeColor(((n.data as any)?.type) || 'other');
                          const label = (n.data as any)?.label || n.id;

                          svg += `<g>`;
                          svg += `<rect x="${x}" y="${y}" rx="8" ry="8" width="${nodeWidth}" height="${nodeHeight}" fill="${bg}" stroke="rgba(255,255,255,0.2)" />`;
                          svg += `<text x="${x + nodeWidth / 2}" y="${y + nodeHeight / 2 + 4}" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="500" fill="#ffffff" text-anchor="middle">${esc(String(label))}</text>`;
                          svg += `</g>`;
                        });

                        svg += `</svg>`;

                        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${selectedProject?.name || 'diagram'}.svg`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);

                      } catch (error) {
                        console.error('SVG export failed:', error);
                        // Fallback to JSON export if building SVG fails
                        const payload = {
                          projectId: selectedProjectId,
                          exportedAt: new Date().toISOString(),
                          nodes: filteredNodes.map((n) => ({
                            id: n.id,
                            label: (n.data as any)?.label,
                            type: (n.data as any)?.type,
                            position: n.position,
                          })),
                          edges: filteredEdges.map((e) => ({ source: e.source, target: e.target })),
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
                      }
                    } else if (exportFormat === 'PNG') {
                      // Export as PNG using html2canvas (would need to install html2canvas)
                      // For now, let's use the toBlob method if available
                      try {
                        const reactFlowElement = document.querySelector('.react-flow');
                        if (reactFlowElement) {
                          // This is a placeholder - would need html2canvas library
                          alert('PNG export requires html2canvas library. Exporting as JSON instead.');
                          // Fallback to JSON
                          const payload = {
                            projectId: selectedProjectId,
                            exportedAt: new Date().toISOString(),
                            nodes: filteredNodes.map(n => ({ 
                              id: n.id, 
                              label: (n.data as any)?.label, 
                              type: (n.data as any)?.type, 
                              position: n.position 
                            })),
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
                        }
                      } catch (error) {
                        console.error('PNG export failed:', error);
                      }
                    }
                    
                    setShowMore(false);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-full text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  Export SVG
                </button>
                <button
                  onClick={() => { 
                    setOrientation('LR'); 
                    setTimeout(() => loadGraph(), 80); 
                    setShowMore(false);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 ${
                    orientation === 'LR' 
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' 
                      : 'bg-white hover:bg-gray-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  Horizontal
                </button>
                <button
                  onClick={() => { 
                    setOrientation('TB'); 
                    setTimeout(() => loadGraph(), 80); 
                    setShowMore(false);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 ${
                    orientation === 'TB' 
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' 
                      : 'bg-white hover:bg-gray-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  Vertical
                </button>
              </div>
            )}
            
            {/* Main floating bubble button with improved styling */}
            <button
              onClick={() => {
                console.log('FLOATING BUTTON CLICKED! showMore was:', showMore);
                setShowMore(v => !v);
              }}
              className="w-14 h-14 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full shadow-xl hover:shadow-2xl flex items-center justify-center text-xl font-bold transition-all duration-300 transform hover:scale-110 border-2 border-white"
              style={{ fontSize: '20px' }}
            >
              {showMore ? '×' : '+'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
