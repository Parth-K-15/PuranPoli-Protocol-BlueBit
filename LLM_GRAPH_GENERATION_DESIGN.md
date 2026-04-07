# LLM Prompt-to-Graph Auto Generation Design (MVP)

## 1. Problem
Manual drag-and-drop graph building is slow and hard for many users. Users should be able to describe their supply chain in plain language and get a usable draft graph instantly.

## 2. Goal
Build a production-feasible flow where:
1. User enters a natural-language prompt.
2. Backend generates a draft graph (nodes + edges).
3. User reviews the draft in the graph canvas.
4. User clicks one Approve button.
5. System persists the graph to the current workspace.

## 3. Non Goals (V1)
1. Per-node or per-edge approval workflows.
2. Fully autonomous optimization and self-healing graph updates.
3. n8n or heavy workflow orchestration.
4. Multi-user collaborative approval.

## 4. Existing Stack Fit
This design reuses current architecture:
1. Frontend: React + React Flow (@xyflow/react).
2. API backend: Node.js + Express + Mongoose.
3. Analytics backend: FastAPI service for risk and lead-time style enrichment.
4. Data stores: existing workspace, node, and edge models.

## 5. High Level Architecture
1. Frontend prompts generation through Express API.
2. Express calls an LLM adapter service (provider-agnostic).
3. Express validates and normalizes output.
4. Express optionally calls analytics enrichment endpoint.
5. Express returns a draft graph with warnings and assumptions.
6. User approves draft.
7. Express persists nodes, edges, and workspace counters.

## 6. Free Tier Friendly LLM Strategy
Use a provider adapter so implementation can switch providers without changing business logic.

Recommended initial options:
1. OpenRouter (single API to multiple models; easy switching).
2. Google Gemini free tier via API key (if available in your region).
3. Groq-hosted models for low-latency draft generation where suitable.

Implementation rule:
1. Never call LLM directly from browser.
2. Keep API keys only in server environment variables.
3. Add timeout and fallback template graph on provider failure.

## 7. API Contracts
Base path: /api/v1

### 7.1 Generate Draft Graph
Endpoint: POST /graph/auto-generate

Request:
```json
{
  "workspaceId": "optional-existing-workspace-id",
  "prompt": "Build a pharma supply chain for paracetamol in Maharashtra with 2 manufacturers and cold-chain distribution",
  "constraints": {
    "maxNodes": 40,
    "maxEdges": 80,
    "country": "India",
    "mustIncludeNodeTypes": ["RawMaterialSource", "Manufacturer", "Distributor", "Retailer"]
  }
}
```

Response:
```json
{
  "generationId": "gen_20260407_abc123",
  "draft": {
    "nodes": [
      {
        "id": "n1",
        "name": "API Supplier West",
        "type": "Tier1Supplier",
        "country": "India",
        "region": "Maharashtra",
        "capacity": 8500,
        "inventory": 2100,
        "reliability_score": 0.84,
        "lead_time_days": 6,
        "risk_score": 0.21,
        "dependency_percentage": 0.35,
        "gmp_status": "Compliant",
        "fda_approval": true,
        "compliance_status": "Good"
      }
    ],
    "edges": [
      {
        "id": "e1",
        "source": "n1",
        "target": "n2",
        "material": "API",
        "lead_time": 3,
        "dependency_percent": 0.45,
        "transport_mode": "Road",
        "risk_score": 0.18
      }
    ]
  },
  "assumptions": [
    "Assumed two regional distributors for urban demand",
    "Assumed one cold-storage node near Pune"
  ],
  "warnings": [
    "No explicit export node requested; domestic chain generated"
  ],
  "validation": {
    "isValid": true,
    "nodeCount": 18,
    "edgeCount": 23
  }
}
```

### 7.2 Approve and Persist Draft
Endpoint: POST /graph/approve-generation

Request:
```json
{
  "generationId": "gen_20260407_abc123",
  "workspaceId": "workspace_001"
}
```

Response:
```json
{
  "success": true,
  "workspaceId": "workspace_001",
  "created": {
    "nodes": 18,
    "edges": 23
  },
  "message": "Draft graph approved and saved"
}
```

### 7.3 Regenerate (Optional V1.1)
Endpoint: POST /graph/regenerate

Request:
```json
{
  "generationId": "gen_20260407_abc123",
  "instruction": "Reduce dependency on a single manufacturer and add one backup supplier"
}
```

## 8. LLM Output Contract
LLM must return strict JSON only with keys:
1. nodes: array
2. edges: array
3. assumptions: array of strings
4. warnings: array of strings

Hard constraints enforced server-side:
1. Allowed node types only:
   RawMaterialSource, Tier3Supplier, Tier2Supplier, Tier1Supplier, Manufacturer, Warehouse, ColdStorage, Distributor, Retailer
2. Edge source and target must reference existing node IDs.
3. Node and edge IDs must be unique.
4. Graph size limits from constraints.
5. Default values are applied to missing optional fields.

## 9. Validation and Normalization Pipeline
1. Parse JSON safely.
2. Validate against schema (Ajv recommended in Express).
3. Normalize IDs and field names.
4. Enforce enum values and ranges.
5. Remove duplicate edges.
6. Reject disconnected graphs when below minimum connectivity threshold.
7. Attach warnings rather than hard-fail for minor assumptions.

Suggested range checks:
1. reliability_score: 0.0 to 1.0
2. risk_score: 0.0 to 1.0
3. dependency_percentage: 0.0 to 1.0
4. lead_time_days and capacity: positive numbers

## 10. Optional ML Enrichment
After draft creation, call analytics service to enrich risk and lead-time fields.

Possible integration:
1. Convert draft nodes into analytics feature input.
2. Call analytics predict-graph style endpoint.
3. Merge predicted values into draft before returning to frontend.
4. Flag low-confidence predictions in warnings.

## 11. Frontend UX Flow (V1)
1. Add an input panel: Prompt + optional constraints.
2. On Generate:
   1. Show loading state and progress message.
   2. Render draft graph on canvas with generated badge.
   3. Show assumptions and warnings side panel.
3. Show single primary action: Approve Graph.
4. Secondary actions: Regenerate, Cancel.
5. On Approve success: show toast with node/edge counts and save state.

## 12. Backend Implementation Plan

### 12.1 New files
1. server/src/services/llmProvider.js
   1. Exports provider interface and selected implementation.
2. server/src/services/graphGenerationService.js
   1. Prompt template building.
   2. LLM call orchestration.
   3. Validation and normalization.
3. server/src/validators/graphDraftSchema.js
   1. JSON schema for draft payload.

### 12.2 Update files
1. server/src/routes/graphRoutes.js
   1. Add /graph/auto-generate and /graph/approve-generation.
2. server/src/controllers/graphController.js
   1. Add controller methods for generate and approve.
3. client/src/services/api.js
   1. Add generateGraph and approveGeneratedGraph methods.
4. client/src/components/GraphCanvas.jsx
   1. Add prompt UI, draft rendering, and approval action.

## 13. Prompt Template (Server Side)
Use a strict instruction style:
1. Role: pharma supply chain planning assistant.
2. Require JSON-only output with no markdown.
3. Provide allowed node types and required fields.
4. Provide max nodes and max edges.
5. Ask for realistic, connected, non-cyclic or minimally cyclic chain (as policy decides).
6. Ask for assumptions and warnings.

Example template snippet:
"Return valid JSON only. Use only allowed node types. Ensure every edge references valid node IDs. Keep output under maxNodes and maxEdges."

## 14. Error Handling
1. LLM timeout: return 504-style API error and fallback suggestion.
2. Invalid JSON from LLM: retry once with repair prompt, then fail with explainable error.
3. Validation fail: return 400 with field-level issues.
4. Provider unavailable: switch to fallback provider if configured.
5. Persist fail on approval: rollback partial inserts and return 500 with trace ID.

## 15. Security
1. Keep provider keys in server env only.
2. Rate-limit generation endpoint per user/session.
3. Add input size limits for prompt and constraints.
4. Log safely without storing secrets.
5. Add basic abuse filters before calling LLM.

## 16. Rollout Plan
1. Feature flag: ENABLE_LLM_GRAPH_GENERATION.
2. Internal testing with known prompts.
3. Beta release to limited users.
4. Full release after KPI thresholds are met.

## 17. KPIs
1. Time to first draft graph.
2. Draft approval rate.
3. Average regenerations per successful approval.
4. Manual edit count after draft generation.
5. Endpoint error and timeout rates.

## 18. MVP Checklist
1. Add provider adapter and env configuration.
2. Implement generate endpoint with schema validation.
3. Implement approve endpoint with persistence.
4. Add frontend prompt + draft + approve flow.
5. Add telemetry events:
   1. generation_started
   2. generation_succeeded
   3. generation_failed
   4. generation_approved
   5. generation_abandoned
6. Add automated tests:
   1. valid generation payload parsing
   2. invalid node type rejection
   3. orphan edge rejection
   4. approval persistence success path

## 19. Why This Works Without n8n
1. Your current Express backend already orchestrates multi-step workflows.
2. LLM orchestration here is straightforward request-response with validation.
3. Provider adapters and structured contracts give reliability without visual workflow tooling.
4. Faster to ship and easier to maintain for your current team size.

## 20. Next Build Step
Implement backend endpoints first, then connect UI prompt flow, then enable feature flag for testing with 10 to 20 curated prompts.
