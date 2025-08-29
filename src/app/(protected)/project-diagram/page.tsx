"use client";
import React, { useEffect, useState, useCallback } from "react";
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

function applyDagreLayout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ 
    rankdir: "TB", 
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
  const [stats, setStats] = useState<{ nodes: number; edges: number } | null>(null);

  // Use current project as default
  useEffect(() => {
    if (projectId && !selectedProjectId) {
      setSelectedProjectId(projectId);
    }
  }, [projectId, selectedProjectId]);

  const loadGraph = useCallback(async () => {
    if (!selectedProjectId) return;
    
    setLoading(true);
    setError(null);
    try {
      const { data }: { data: GraphData } = await axios.get(`/api/graph?projectId=${selectedProjectId}`);
      
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

      const positioned = applyDagreLayout(rfNodes, rfEdges);
      setNodes(positioned);
      setEdges(rfEdges);
      setStats(data.total);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || "Failed to load graph");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      loadGraph();
    }
  }, [loadGraph, selectedProjectId]);

  const selectedProject = projects?.find(p => p.id === selectedProjectId);

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
                onValueChange={setSelectedProjectId}
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
            
            {/* Legend */}
            <Card className="p-3">
              <div className="text-xs font-medium mb-2">File Types</div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { type: 'page', label: 'Pages' },
                  { type: 'api', label: 'API' },
                  { type: 'component', label: 'Components' },
                  { type: 'hook', label: 'Hooks' },
                  { type: 'utility', label: 'Utils' },
                  { type: 'server', label: 'Server' }
                ].map(({ type, label }) => (
                  <div key={type} className="flex items-center gap-1">
                    <div 
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: getNodeColor(type) }}
                    />
                    <span className="text-xs">{label}</span>
                  </div>
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

      {/* Flow */}
      <div style={{ height: "calc(100vh - 120px)", width: "100%" }}>
        <ReactFlowProvider>
          <ReactFlow 
            nodes={nodes} 
            edges={edges} 
            fitView 
            nodesDraggable={true}
            elementsSelectable={true}
            defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
            minZoom={0.1}
            maxZoom={2}
            className="bg-slate-50 dark:bg-slate-950"
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
        </ReactFlowProvider>
      </div>
    </div>
  );
}
