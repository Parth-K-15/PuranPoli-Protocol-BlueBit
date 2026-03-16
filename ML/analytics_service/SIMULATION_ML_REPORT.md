# ML Simulation Engine Report

## 1) Objective
The simulation module was upgraded from rule-based scoring to model-based scoring.

Before: risk was updated with fixed multipliers.

Now: each impacted node risk is predicted by trained ML models using perturbed node features, while graph traversal still uses BFS.

---

## 2) Implementation Scope
### Backend (FastAPI)
Primary implementation is in [ML/analytics_service/main.py](ML/analytics_service/main.py).

Key areas:
- Model training lifecycle at startup and reload
- Feature mapping from graph node payloads
- Deterministic disruption perturbation logic
- ML inference for origin and each BFS hop
- Simulation endpoint contract and validation

### Frontend (React)
Simulation integration is implemented in:
- [client/src/services/api.js](client/src/services/api.js)
- [client/src/pages/SimulationPage.jsx](client/src/pages/SimulationPage.jsx)

---

## 3) Model Architecture
Two GradientBoosting pipelines are trained from the pharma CSV dataset.

1. Risk model
- Learns target: `composite_risk_score`
- Output: predicted simulation risk (0-100)

2. Lead-time model
- Learns target: `lead_time_volatility_days`
- Output: predicted lead-time volatility used to derive lead-time increase

Training happens during startup and again on `POST /reload`.

Runtime state includes:
- `simulation_risk_model`
- `simulation_lead_time_model`
- `simulation_training_ok`
- `simulation_model_version = simulation_ml_v1`

---

## 4) Feature Schema Used by ML
The simulation model expects this 10-feature vector:
- `financial_health_score`
- `historical_delay_frequency_pct`
- `batch_failure_rate_pct`
- `lead_time_volatility_days`
- `dependency_pct`
- `capacity_utilization_pct`
- `gmp_status`
- `fda_approved`
- `active_disruption_signal`
- `compliance_violation_flag`

Node payloads are normalized in `_node_to_features` with safe defaults.

Additional compatibility handling implemented:
- `dependency_percentage` -> `dependency_pct` fallback
- `capacity_utilization` -> `capacity_utilization_pct` fallback
- `fda_approval` -> `fda_approved` fallback
- String statuses (for example: Certified, Pending, Not Required) are converted to binary via `_to_binary`

This removed the previous validation failures for boolean fields.

---

## 5) Disruption Logic (Deterministic Perturbation)
The model is data-driven for scoring, but disruption semantics are deterministic for realism.

- supplier_failure
  - `active_disruption_signal = 1`
  - `financial_health_score -= severity * 0.5`
  - `batch_failure_rate_pct += severity * 0.4`

- transport_delay
  - `historical_delay_frequency_pct += severity * 0.5`
  - `lead_time_volatility_days += severity * 0.4`

- demand_surge
  - `capacity_utilization_pct += severity * 0.6`
  - `active_disruption_signal = 1`

- natural_disaster
  - `active_disruption_signal = 1`
  - `financial_health_score -= severity * 0.4`
  - `lead_time_volatility_days += severity * 0.3`

- quality_issue
  - `batch_failure_rate_pct += severity * 0.7`
  - `compliance_violation_flag = 1`

- regulatory_change
  - `compliance_violation_flag = 1`
  - `gmp_status = 0`
  - `fda_approved = 0`

---

## 6) BFS Cascade with ML Scoring
Traversal remains BFS, scoring is ML at each hop.

Flow:
1. Origin node receives disruption (severity normalized from 0-10 to 0-1).
2. Features are perturbed.
3. ML predicts origin risk and lead-time impact.
4. Neighbors are visited by BFS with hop attenuation.
5. At each hop, perturbed features are re-evaluated by ML.

Propagation controls:
- Hop attenuation: `0.55`
- `max_hops` (default 4)
- `risk_threshold` gate to decide whether to continue propagation

---

## 7) API Contract
Endpoint: `POST /analytics/simulate`

Request core fields:
- `origin_node_id`
- `disruption_type`
- `severity` (0-10)
- `nodes[]`
- `max_hops`
- `risk_threshold`

Response core fields:
- `model` (now `simulation_ml_v1`)
- `origin_risk`
- `origin_lt_inc`
- `origin_cap_impact`
- `affected_nodes[]`
- `total_affected`

---

## 8) Frontend Integration Behavior
The simulation page now:
- Builds node/edge payload from graph data
- Converts UI severity percent to API severity scale
- Calls backend simulation API instead of client-side mock
- Renders model-driven impacted nodes and risk deltas
- Safely formats validation error payloads into readable text

---

## 9) Verification Summary
Validated in runtime:
- Analytics health endpoint reachable
- Simulation endpoint returns `simulation_ml_v1`
- Mixed node field formats (boolean and string statuses) accepted
- Different disruption types produce different risk/lead-time signatures

Example observed distinction:
- quality_issue, regulatory_change, supplier_failure returned different combinations of:
  - `origin_risk`
  - `origin_lt_inc`
  - `total_affected`

This confirms scoring is no longer a flat multiplier pattern.

---

## 10) Current Status
Simulation is operational and ML-driven in production entrypoint [ML/analytics_service/main.py](ML/analytics_service/main.py), integrated with UI flow, and validated against realistic graph payload variability.