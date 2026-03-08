const demoNodes = [
  { id: "raw_1", name: "Lithium Mine Chile", type: "RawMaterialSource", country: "Chile", region: "South America", capacity: 90000, inventory: 22000, risk_score: 32, lead_time_days: 14, reliability_score: 72, dependency_percentage: 18, compliance_status: "Compliant", position: { x: 30, y: 80 } },
  { id: "raw_2", name: "Herbal Extract India", type: "RawMaterialSource", country: "India", region: "South Asia", capacity: 76000, inventory: 18000, risk_score: 41, lead_time_days: 10, reliability_score: 75, dependency_percentage: 22, compliance_status: "Compliant", position: { x: 30, y: 220 } },
  { id: "raw_3", name: "Solvent Feedstock EU", type: "RawMaterialSource", country: "Germany", region: "Europe", capacity: 65000, inventory: 15000, risk_score: 26, lead_time_days: 8, reliability_score: 84, dependency_percentage: 14, compliance_status: "Compliant", position: { x: 30, y: 360 } },

  { id: "t3_1", name: "Chemical Intermediates A", type: "Tier3Supplier", country: "China", region: "East Asia", capacity: 70000, inventory: 14000, risk_score: 62, lead_time_days: 12, reliability_score: 61, dependency_percentage: 33, compliance_status: "Watchlist", position: { x: 270, y: 50 } },
  { id: "t3_2", name: "Catalyst Producer B", type: "Tier3Supplier", country: "Vietnam", region: "Southeast Asia", capacity: 62000, inventory: 12000, risk_score: 47, lead_time_days: 11, reliability_score: 70, dependency_percentage: 24, compliance_status: "Compliant", position: { x: 270, y: 190 } },
  { id: "t3_3", name: "Reagent House C", type: "Tier3Supplier", country: "Poland", region: "Europe", capacity: 54000, inventory: 11000, risk_score: 38, lead_time_days: 9, reliability_score: 79, dependency_percentage: 20, compliance_status: "Compliant", position: { x: 270, y: 330 } },

  { id: "t2_1", name: "API Supplier Alpha", type: "Tier2Supplier", country: "China", region: "East Asia", capacity: 80000, inventory: 17000, risk_score: 71, lead_time_days: 15, reliability_score: 58, dependency_percentage: 40, compliance_status: "Watchlist", position: { x: 520, y: 40 } },
  { id: "t2_2", name: "API Supplier Beta", type: "Tier2Supplier", country: "India", region: "South Asia", capacity: 86000, inventory: 21000, risk_score: 44, lead_time_days: 10, reliability_score: 77, dependency_percentage: 30, compliance_status: "Compliant", position: { x: 520, y: 180 } },
  { id: "t2_3", name: "API Supplier Gamma", type: "Tier2Supplier", country: "Ireland", region: "Europe", capacity: 59000, inventory: 12000, risk_score: 29, lead_time_days: 8, reliability_score: 88, dependency_percentage: 18, compliance_status: "Compliant", position: { x: 520, y: 320 } },

  { id: "t1_1", name: "Formulation Supplier One", type: "Tier1Supplier", country: "India", region: "South Asia", capacity: 74000, inventory: 16000, risk_score: 36, lead_time_days: 7, reliability_score: 82, dependency_percentage: 28, compliance_status: "Compliant", position: { x: 770, y: 70 } },
  { id: "t1_2", name: "Formulation Supplier Two", type: "Tier1Supplier", country: "Mexico", region: "North America", capacity: 51000, inventory: 9000, risk_score: 58, lead_time_days: 12, reliability_score: 68, dependency_percentage: 25, compliance_status: "Compliant", position: { x: 770, y: 210 } },
  { id: "t1_3", name: "Formulation Supplier Three", type: "Tier1Supplier", country: "Turkey", region: "Middle East", capacity: 47000, inventory: 8500, risk_score: 49, lead_time_days: 10, reliability_score: 73, dependency_percentage: 19, compliance_status: "Compliant", position: { x: 770, y: 350 } },

  { id: "mfg_1", name: "Drug Plant North", type: "Manufacturer", country: "USA", region: "North America", capacity: 98000, inventory: 32000, risk_score: 34, lead_time_days: 6, reliability_score: 86, dependency_percentage: 46, compliance_status: "Compliant", position: { x: 1020, y: 120 } },
  { id: "mfg_2", name: "Drug Plant South", type: "Manufacturer", country: "Brazil", region: "South America", capacity: 72000, inventory: 24000, risk_score: 52, lead_time_days: 8, reliability_score: 71, dependency_percentage: 38, compliance_status: "Compliant", position: { x: 1020, y: 290 } },

  { id: "wh_1", name: "Central Warehouse", type: "Warehouse", country: "Netherlands", region: "Europe", capacity: 110000, inventory: 43000, risk_score: 28, lead_time_days: 4, reliability_score: 89, dependency_percentage: 54, compliance_status: "Compliant", position: { x: 1260, y: 130 } },
  { id: "wh_2", name: "Regional Warehouse", type: "Warehouse", country: "UAE", region: "Middle East", capacity: 84000, inventory: 30000, risk_score: 43, lead_time_days: 5, reliability_score: 78, dependency_percentage: 33, compliance_status: "Compliant", position: { x: 1260, y: 300 } },
  { id: "cold_1", name: "Cold Storage Hub", type: "ColdStorage", country: "Singapore", region: "Southeast Asia", capacity: 45000, inventory: 15000, risk_score: 46, lead_time_days: 3, reliability_score: 80, dependency_percentage: 21, compliance_status: "Compliant", position: { x: 1260, y: 470 } },

  { id: "dist_1", name: "Global Distributor", type: "Distributor", country: "UK", region: "Europe", capacity: 90000, inventory: 36000, risk_score: 39, lead_time_days: 6, reliability_score: 83, dependency_percentage: 57, compliance_status: "Compliant", position: { x: 1510, y: 180 } },
  { id: "dist_2", name: "APAC Distributor", type: "Distributor", country: "Japan", region: "East Asia", capacity: 68000, inventory: 26000, risk_score: 48, lead_time_days: 7, reliability_score: 74, dependency_percentage: 34, compliance_status: "Compliant", position: { x: 1510, y: 360 } },

  { id: "ret_1", name: "Hospital Network A", type: "Retailer", country: "Canada", region: "North America", capacity: 42000, inventory: 17000, risk_score: 27, lead_time_days: 2, reliability_score: 90, dependency_percentage: 61, compliance_status: "Compliant", position: { x: 1770, y: 210 } },
  { id: "ret_2", name: "Pharmacy Chain B", type: "Retailer", country: "Australia", region: "Oceania", capacity: 39000, inventory: 14000, risk_score: 35, lead_time_days: 3, reliability_score: 85, dependency_percentage: 44, compliance_status: "Compliant", position: { x: 1770, y: 390 } },
];

const demoEdges = [
  { edge_id: "e_1", source_node: "raw_1", target_node: "t3_1", material: "Lithium salts", lead_time: 14, dependency_percent: 30, transport_mode: "Sea" },
  { edge_id: "e_2", source_node: "raw_1", target_node: "t3_2", material: "Ore blend", lead_time: 12, dependency_percent: 22, transport_mode: "Sea" },
  { edge_id: "e_3", source_node: "raw_2", target_node: "t3_2", material: "Plant extract", lead_time: 10, dependency_percent: 38, transport_mode: "Road" },
  { edge_id: "e_4", source_node: "raw_2", target_node: "t3_3", material: "Bio feed", lead_time: 9, dependency_percent: 20, transport_mode: "Air" },
  { edge_id: "e_5", source_node: "raw_3", target_node: "t3_1", material: "Solvent base", lead_time: 8, dependency_percent: 24, transport_mode: "Road" },
  { edge_id: "e_6", source_node: "raw_3", target_node: "t3_3", material: "Purified solvent", lead_time: 7, dependency_percent: 29, transport_mode: "Road" },

  { edge_id: "e_7", source_node: "t3_1", target_node: "t2_1", material: "Intermediate X", lead_time: 11, dependency_percent: 45, transport_mode: "Sea" },
  { edge_id: "e_8", source_node: "t3_2", target_node: "t2_1", material: "Intermediate Y", lead_time: 10, dependency_percent: 27, transport_mode: "Sea" },
  { edge_id: "e_9", source_node: "t3_2", target_node: "t2_2", material: "Catalyst mix", lead_time: 9, dependency_percent: 34, transport_mode: "Road" },
  { edge_id: "e_10", source_node: "t3_3", target_node: "t2_3", material: "Reagent kit", lead_time: 8, dependency_percent: 41, transport_mode: "Road" },
  { edge_id: "e_11", source_node: "t3_1", target_node: "t2_2", material: "Intermediate Z", lead_time: 12, dependency_percent: 18, transport_mode: "Air" },

  { edge_id: "e_12", source_node: "t2_1", target_node: "t1_1", material: "API batch A", lead_time: 9, dependency_percent: 36, transport_mode: "Air" },
  { edge_id: "e_13", source_node: "t2_1", target_node: "t1_2", material: "API batch B", lead_time: 11, dependency_percent: 22, transport_mode: "Sea" },
  { edge_id: "e_14", source_node: "t2_2", target_node: "t1_1", material: "API batch C", lead_time: 8, dependency_percent: 31, transport_mode: "Road" },
  { edge_id: "e_15", source_node: "t2_2", target_node: "t1_3", material: "API batch D", lead_time: 10, dependency_percent: 24, transport_mode: "Road" },
  { edge_id: "e_16", source_node: "t2_3", target_node: "t1_2", material: "API batch E", lead_time: 7, dependency_percent: 35, transport_mode: "Road" },

  { edge_id: "e_17", source_node: "t1_1", target_node: "mfg_1", material: "Formula Set 1", lead_time: 6, dependency_percent: 48, transport_mode: "Road" },
  { edge_id: "e_18", source_node: "t1_2", target_node: "mfg_1", material: "Formula Set 2", lead_time: 7, dependency_percent: 26, transport_mode: "Sea" },
  { edge_id: "e_19", source_node: "t1_3", target_node: "mfg_2", material: "Formula Set 3", lead_time: 8, dependency_percent: 44, transport_mode: "Road" },
  { edge_id: "e_20", source_node: "t1_1", target_node: "mfg_2", material: "Formula Set 4", lead_time: 7, dependency_percent: 21, transport_mode: "Air" },

  { edge_id: "e_21", source_node: "mfg_1", target_node: "wh_1", material: "Finished tablets", lead_time: 4, dependency_percent: 55, transport_mode: "Road" },
  { edge_id: "e_22", source_node: "mfg_2", target_node: "wh_2", material: "Injectables", lead_time: 5, dependency_percent: 49, transport_mode: "Sea" },
  { edge_id: "e_23", source_node: "mfg_1", target_node: "cold_1", material: "Vaccines", lead_time: 3, dependency_percent: 38, transport_mode: "Air" },
  { edge_id: "e_24", source_node: "wh_1", target_node: "dist_1", material: "Bulk shipments", lead_time: 5, dependency_percent: 62, transport_mode: "Road" },
  { edge_id: "e_25", source_node: "wh_2", target_node: "dist_2", material: "Regional stock", lead_time: 6, dependency_percent: 51, transport_mode: "Sea" },
  { edge_id: "e_26", source_node: "cold_1", target_node: "dist_2", material: "Cold chain lots", lead_time: 4, dependency_percent: 33, transport_mode: "Air" },
  { edge_id: "e_27", source_node: "dist_1", target_node: "ret_1", material: "Hospital orders", lead_time: 2, dependency_percent: 64, transport_mode: "Road" },
  { edge_id: "e_28", source_node: "dist_2", target_node: "ret_2", material: "Pharmacy orders", lead_time: 3, dependency_percent: 58, transport_mode: "Road" },
  { edge_id: "e_29", source_node: "dist_1", target_node: "ret_2", material: "Overflow supply", lead_time: 4, dependency_percent: 21, transport_mode: "Air" },
];

module.exports = {
  demoNodes,
  demoEdges,
};
