export const NODE_META = {
  Manufacturer: {
    title: "My Node",
    subtitle: "Supplier End Point",
    icon: "person_pin_circle",
    iconClass: "bg-blue-100 text-blue-600",
  },
  RawMaterialSource: {
    title: "Raw Materials",
    subtitle: "Upstream source",
    icon: "biotech",
    iconClass: "bg-amber-100 text-amber-700",
  },
  Tier1Supplier: {
    title: "Tier 1 Supplier",
    subtitle: "Direct supplier",
    icon: "factory",
    iconClass: "bg-indigo-100 text-indigo-700",
  },
  Tier2Supplier: {
    title: "Tier 2 Supplier",
    subtitle: "Sub-supplier",
    icon: "precision_manufacturing",
    iconClass: "bg-violet-100 text-violet-700",
  },
  Tier3Supplier: {
    title: "Tier 3 Supplier",
    subtitle: "Deep-tier source",
    icon: "domain",
    iconClass: "bg-fuchsia-100 text-fuchsia-700",
  },
};

export const NODE_TYPES = Object.keys(NODE_META);
