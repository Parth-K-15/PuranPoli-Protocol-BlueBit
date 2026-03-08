const express = require("express");

const {
  listCatalog,
  getCatalogItem,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  seedCatalog,
} = require("../controllers/catalogController");

const router = express.Router();

router.get("/catalog", listCatalog);
router.post("/catalog/seed", seedCatalog);
router.post("/catalog", createCatalogItem);
router.get("/catalog/:catalogId", getCatalogItem);
router.patch("/catalog/:catalogId", updateCatalogItem);
router.delete("/catalog/:catalogId", deleteCatalogItem);

module.exports = router;
