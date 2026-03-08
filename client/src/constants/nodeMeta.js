export const NODE_META = {
  RawMaterialSource: {
    title: "Raw Material",
    subtitle: "Input Node",
    icon: "inventory_2",
    iconClass: "bg-[#a390f9] text-white",
  },
  Tier3Supplier: {
    title: "Tier 3 Supplier",
    subtitle: "Pre-Processing",
    icon: "science",
    iconClass: "bg-indigo-100 text-indigo-600",
  },
  Tier2Supplier: {
    title: "Tier 2 Supplier",
    subtitle: "Refining",
    icon: "precision_manufacturing",
    iconClass: "bg-violet-100 text-violet-600",
  },
  Tier1Supplier: {
    title: "Tier 1 Supplier",
    subtitle: "Primary Logistics",
    icon: "local_shipping",
    iconClass: "bg-blue-100 text-blue-600",
  },
  Manufacturer: {
    title: "Manufacturer",
    subtitle: "Production",
    icon: "factory",
    iconClass: "bg-pink-100 text-pink-600",
  },
  Warehouse: {
    title: "Warehouse",
    subtitle: "Storage Node",
    icon: "warehouse",
    iconClass: "bg-emerald-100 text-emerald-600",
  },
  ColdStorage: {
    title: "Cold Storage",
    subtitle: "Temperature-Controlled",
    icon: "ac_unit",
    iconClass: "bg-cyan-100 text-cyan-600",
  },
  Distributor: {
    title: "Distributor",
    subtitle: "Regional Hub",
    icon: "hub",
    iconClass: "bg-fuchsia-100 text-fuchsia-600",
  },
  Retailer: {
    title: "Retailer",
    subtitle: "End Point",
    icon: "storefront",
    iconClass: "bg-orange-100 text-orange-600",
  },
};

export const NODE_TYPES = Object.keys(NODE_META);
