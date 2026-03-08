const { StatusCodes } = require("http-status-codes");
const { CatalogItem, CATALOG_NODE_TYPES } = require("../models/CatalogItem");
const { nodeCatalog } = require("../data/nodeCatalog");

// GET /catalog  — list all, optionally filtered by ?type=
const listCatalog = async (req, res) => {
  const { type, search } = req.query;
  const filter = {};

  if (type && CATALOG_NODE_TYPES.includes(type)) {
    filter.type = type;
  }

  if (search) {
    const regex = new RegExp(search, "i");
    filter.$or = [{ name: regex }, { country: regex }, { region: regex }];
  }

  const items = await CatalogItem.find(filter).sort({ type: 1, name: 1 }).lean();

  // Group by type
  const catalog = {};
  for (const item of items) {
    if (!catalog[item.type]) catalog[item.type] = [];
    catalog[item.type].push(item);
  }

  res.status(StatusCodes.OK).json({ success: true, catalog, total: items.length });
};

// GET /catalog/:catalogId  — single item
const getCatalogItem = async (req, res) => {
  const item = await CatalogItem.findOne({ catalogId: req.params.catalogId }).lean();
  if (!item) {
    return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Catalog item not found" });
  }
  res.status(StatusCodes.OK).json({ success: true, item });
};

// POST /catalog  — create new catalog item
const createCatalogItem = async (req, res) => {
  const { type, name } = req.body;

  if (!type || !name) {
    return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: "type and name are required" });
  }

  if (!CATALOG_NODE_TYPES.includes(type)) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: `Invalid type. Allowed: ${CATALOG_NODE_TYPES.join(", ")}`,
    });
  }

  const catalogId = `cat_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const item = await CatalogItem.create({ ...req.body, catalogId });
  res.status(StatusCodes.CREATED).json({ success: true, item });
};

// PATCH /catalog/:catalogId  — update
const updateCatalogItem = async (req, res) => {
  const payload = { ...req.body };
  delete payload.catalogId; // prevent changing the ID

  if (payload.type && !CATALOG_NODE_TYPES.includes(payload.type)) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: `Invalid type. Allowed: ${CATALOG_NODE_TYPES.join(", ")}`,
    });
  }

  const item = await CatalogItem.findOneAndUpdate(
    { catalogId: req.params.catalogId },
    payload,
    { new: true, runValidators: true }
  );

  if (!item) {
    return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Catalog item not found" });
  }

  res.status(StatusCodes.OK).json({ success: true, item });
};

// DELETE /catalog/:catalogId
const deleteCatalogItem = async (req, res) => {
  const item = await CatalogItem.findOneAndDelete({ catalogId: req.params.catalogId });
  if (!item) {
    return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Catalog item not found" });
  }
  res.status(StatusCodes.OK).json({ success: true, message: `Catalog item ${req.params.catalogId} deleted` });
};

// POST /catalog/seed — seed the DB from the static file (idempotent)
const seedCatalog = async (_req, res) => {
  let created = 0;

  for (const [type, items] of Object.entries(nodeCatalog)) {
    for (const item of items) {
      const exists = await CatalogItem.exists({ catalogId: item.catalogId });
      if (!exists) {
        await CatalogItem.create({ ...item, type });
        created++;
      }
    }
  }

  res.status(StatusCodes.OK).json({ success: true, message: `Seeded ${created} new catalog items` });
};

module.exports = {
  listCatalog,
  getCatalogItem,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  seedCatalog,
};
