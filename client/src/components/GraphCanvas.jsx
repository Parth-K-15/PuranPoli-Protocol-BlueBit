import { useCallback, useEffect, useState } from "react";
import {
  addEdge,
  Background,
  MiniMap,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";

import CustomNode from "./CustomNode";
import NodeCatalogModal from "./NodeCatalogModal";
import { analyticsApi, graphApi } from "../services/api";

const nodeTypes = {
  supplyNode: CustomNode,
};

const createNodeId = () => `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
const createEdgeId = () => `edge_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

const defaultNodeData = (nodeType, id) => ({
  id,
  name: `${nodeType} ${id.slice(-4)}`,
  type: nodeType,
  country: "",
  region: "",
  capacity: 0,
  inventory: 0,
  risk_score: 0,
  lead_time_days: 0,
  reliability_score: 0,
  dependency_percentage: 0,
  compliance_status: "Unknown",
});

const getRelationshipText = (sourceType, targetType) => {
  if (sourceType === "RawMaterialSource" && targetType === "Tier3Supplier") {
    return "SUPPLIES";
  }

  if (sourceType === "Tier3Supplier" && targetType === "Tier2Supplier") {
    return "PROCESSES";
  }

  if (sourceType === "Tier2Supplier" && targetType === "Tier1Supplier") {
    return "REFINES";
  }

  if (sourceType === "Tier1Supplier" && targetType === "Manufacturer") {
    return "ASSEMBLES";
  }

  if (
    sourceType === "Manufacturer" &&
    (targetType === "Warehouse" || targetType === "ColdStorage")
  ) {
    return "STORES_AT";
  }

  if (sourceType === "Manufacturer") {
    return "PACKAGES";
  }

  if (sourceType === "Warehouse" || sourceType === "ColdStorage") {
    return "TRANSPORTS_TO";
  }

  if (sourceType === "Distributor" && targetType === "Retailer") {
    return "DELIVERS_TO";
  }

  if (sourceType === "Distributor") {
    return "DISTRIBUTES_TO";
  }

  if (sourceType === "Retailer") {
    return "SELLS_TO";
  }

  if (
    sourceType === "Tier1Supplier" ||
    sourceType === "Tier2Supplier" ||
    sourceType === "Tier3Supplier"
  ) {
    return "SUPPLIES";
  }

  return "TRANSPORTS_TO";
};

const withRelationshipLabel = (edge, nodeTypeById) => {
  const sourceType = nodeTypeById[edge.source];
  const targetType = nodeTypeById[edge.target];
  const relationship = getRelationshipText(sourceType, targetType);

  return {
    ...edge,
    label: relationship,
    labelStyle: {
      fill: "#6d6fd8",
      fontSize: 11,
      fontWeight: 700,
    },
    labelBgStyle: {
      fill: "#ffffff",
      stroke: "#b1b2ff44",
      strokeWidth: 1,
    },
    labelBgPadding: [6, 2],
    labelBgBorderRadius: 4,
  };
};

function GraphCanvas({ onNodeSelect, refreshToken, setRefreshToken, workspaceId }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [catalogModal, setCatalogModal] = useState(null); // { nodeType, position }
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();

  const enrichNodesWithSpof = useCallback(async (baseNodes, baseEdges) => {
    if (baseNodes.length === 0) {
      return baseNodes;
    }

    const fallbackNodes = baseNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        is_spof: Boolean(
          node.data?.is_spof ||
          node.data?.is_articulation_point ||
          node.data?.single_point_of_failure
        ),
      },
    }));

    try {
      const prediction = await analyticsApi.predictGraph({
        nodes: baseNodes,
        edges: baseEdges,
      });
      const nodePredictions = prediction?.predictions?.node_predictions || [];
      const spofNodeIds = new Set(
        nodePredictions
          .filter((item) => item?.is_articulation_point)
          .map((item) => item?.node_id)
          .filter(Boolean)
      );

      return fallbackNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          is_spof: node.data?.is_spof || spofNodeIds.has(node.id),
        },
      }));
    } catch (error) {
      console.warn("SPOF enrichment unavailable, using existing node flags", error);
      return fallbackNodes;
    }
  }, []);

  const loadGraph = useCallback(async () => {
    if (!workspaceId) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const response = await graphApi.getGraph(workspaceId);
    const loadedNodes = response.nodes || [];
    const nodeTypeById = Object.fromEntries(
      loadedNodes.map((node) => [node.id, node.data?.type])
    );
    const loadedEdges = (response.edges || []).map((edge) =>
      withRelationshipLabel(edge, nodeTypeById)
    );

    const enrichedNodes = await enrichNodesWithSpof(loadedNodes, loadedEdges);

    setNodes(enrichedNodes);
    setEdges(loadedEdges);
    setSelectedEdgeId(null);
  }, [enrichNodesWithSpof, setEdges, setNodes, workspaceId]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph, refreshToken]);

  const onConnect = useCallback(
    async (params) => {
      if (!workspaceId) {
        return;
      }

      const edgeId = createEdgeId();
      const sourceType = nodes.find((node) => node.id === params.source)?.data?.type;
      const targetType = nodes.find((node) => node.id === params.target)?.data?.type;
      const relationship = getRelationshipText(sourceType, targetType);
      const payload = {
        edge_id: edgeId,
        source_node: params.source,
        target_node: params.target,
        material: "",
        lead_time: 0,
        dependency_percent: 0,
        transport_mode: "",
        risk_score: 0,
        workspace: workspaceId,
      };

      try {
        await graphApi.createEdge(payload);
        setEdges((eds) =>
          addEdge(
            {
              ...params,
              id: edgeId,
              label: relationship,
              labelStyle: {
                fill: "#6d6fd8",
                fontSize: 11,
                fontWeight: 700,
              },
              labelBgStyle: {
                fill: "#ffffff",
                stroke: "#b1b2ff44",
                strokeWidth: 1,
              },
              labelBgPadding: [6, 2],
              labelBgBorderRadius: 4,
              markerEnd: { type: "arrowclosed" },
            },
            eds
          )
        );
      } catch (error) {
        console.error("Failed to create edge", error);
      }
    },
    [nodes, setEdges, workspaceId]
  );

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData("application/reactflow");

      if (!nodeType || !workspaceId) {
        return;
      }

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setCatalogModal({ nodeType, position });
    },
    [screenToFlowPosition, workspaceId]
  );

  const handleCatalogSelect = useCallback(
    async (nodeData) => {
      if (!workspaceId) return;
      const id = createNodeId();
      const position = catalogModal?.position || { x: 0, y: 0 };

      const payload = {
        id,
        ...nodeData,
        position,
        workspace: workspaceId,
      };

      try {
        const response = await graphApi.createNode(payload);
        setNodes((nds) => nds.concat(response.node));
      } catch (error) {
        console.error("Failed to create node", error);
      } finally {
        setCatalogModal(null);
      }
    },
    [workspaceId, catalogModal, setNodes]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onNodeClick = useCallback(
    (_event, node) => {
      onNodeSelect(node);
      setSelectedEdgeId(null);
    },
    [onNodeSelect]
  );

  const onEdgeClick = useCallback((_event, edge) => {
    setSelectedEdgeId(edge.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedEdgeId(null);
  }, []);

  const handleDeleteSelectedEdge = useCallback(async () => {
    if (!selectedEdgeId) {
      return;
    }

    try {
      await graphApi.deleteEdge(selectedEdgeId);
      setEdges((prevEdges) => prevEdges.filter((edge) => edge.id !== selectedEdgeId));
      setSelectedEdgeId(null);
    } catch (error) {
      console.error("Failed to delete selected edge", error);
      setRefreshToken((prev) => prev + 1);
    }
  }, [selectedEdgeId, setEdges, setRefreshToken]);

  const onNodeDragStop = useCallback(
    async (_event, node) => {
      if (!workspaceId) {
        return;
      }
      try {
        await graphApi.updateNode(node.id, { position: node.position });
      } catch (error) {
        console.error("Failed to save node position", error);
      }
    },
    [workspaceId]
  );

  const onEdgesDelete = useCallback(async (deletedEdges) => {
    try {
      await Promise.all(deletedEdges.map((edge) => graphApi.deleteEdge(edge.id)));
    } catch (error) {
      console.error("Failed to delete edges", error);
      setRefreshToken((prev) => prev + 1);
    }
  }, [setRefreshToken]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        defaultEdgeOptions={{
          animated: false,
          style: {
            stroke: "#b1b2ff",
            strokeWidth: 2,
            strokeDasharray: "4 4",
          },
        }}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        onEdgesDelete={onEdgesDelete}
        fitView
        minZoom={0.3}
        maxZoom={1.8}
      >
        <Background gap={40} size={1} color="#b1b2ff33" />

        <MiniMap
          position="top-right"
          pannable
          zoomable
          className="!mt-4 !mr-4 !h-32 !w-52 !rounded-xl !border !border-[#b1b2ff]/20 !bg-white/90 !shadow-xl"
          nodeColor="#b1b2ff"
        />

        <Panel position="bottom-left">
          <div className="flex items-center gap-2 rounded-xl border border-[#b1b2ff]/10 bg-white/80 p-2 shadow-xl backdrop-blur-sm">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-[#b1b2ff]/10"
              onClick={() => zoomIn({ duration: 200 })}
              title="Zoom In"
            >
              <span className="material-symbols-outlined">add</span>
            </button>

            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-[#b1b2ff]/10"
              onClick={() => zoomOut({ duration: 200 })}
              title="Zoom Out"
            >
              <span className="material-symbols-outlined">remove</span>
            </button>

            <div className="h-6 w-px bg-slate-200" />

            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-[#b1b2ff]/10"
              onClick={() => fitView({ duration: 300, padding: 0.2 })}
              title="Fit View"
            >
              <span className="material-symbols-outlined">filter_center_focus</span>
            </button>
          </div>
        </Panel>

        {selectedEdgeId && (
          <Panel position="top-left">
            <div className="ml-4 mt-4 flex items-center gap-3 rounded-xl border border-[#b1b2ff]/20 bg-white/95 px-4 py-2 shadow-lg backdrop-blur-sm">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Selected Edge</p>
                <p className="text-xs font-semibold text-slate-700">{selectedEdgeId}</p>
              </div>

              <button
                type="button"
                className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                onClick={handleDeleteSelectedEdge}
              >
                Delete Edge
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {catalogModal && (
        <NodeCatalogModal
          nodeType={catalogModal.nodeType}
          position={catalogModal.position}
          existingNodes={nodes}
          workspaceId={workspaceId}
          onSelect={handleCatalogSelect}
          onClose={() => setCatalogModal(null)}
        />
      )}
    </div>
  );
}

export default GraphCanvas;
