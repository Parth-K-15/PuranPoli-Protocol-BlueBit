import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import CustomNode from "./CustomNode";

const nodeTypes = { supplyNode: CustomNode };

function ChainPreviewInner({
  nodes = [],
  edges = [],
  onNodeClick,
  highlightNodeId,
}) {
  const { fitView } = useReactFlow();

  const styledNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        style:
          highlightNodeId && node.id === highlightNodeId
            ? {
                boxShadow: "0 0 0 3px #a390f9",
                borderRadius: "1rem",
              }
            : undefined,
      })),
    [nodes, highlightNodeId]
  );

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        style: {
          stroke: "#b1b2ff",
          strokeWidth: 2,
          strokeDasharray: "4 4",
          ...(edge.style || {}),
        },
      })),
    [edges]
  );

  const handleNodeClick = useCallback(
    (_event, node) => {
      if (onNodeClick) onNodeClick(node);
    },
    [onNodeClick]
  );

  return (
    <div className="h-full w-full rounded-xl border border-[#b1b2ff]/10 bg-slate-50/50">
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={!!onNodeClick}
        onNodeClick={onNodeClick ? handleNodeClick : undefined}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={30} size={1} color="#b1b2ff22" />
        <Controls
          showInteractive={false}
          className="!rounded-xl !border !border-[#b1b2ff]/10 !bg-white/90 !shadow-lg"
        />
      </ReactFlow>
    </div>
  );
}

function ChainPreview(props) {
  return (
    <ReactFlowProvider>
      <ChainPreviewInner {...props} />
    </ReactFlowProvider>
  );
}

export default ChainPreview;
