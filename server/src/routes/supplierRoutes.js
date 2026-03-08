const express = require("express");
const router = express.Router();
const {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  importFromCsv,
  clearSuppliers,
} = require("../controllers/supplierController");

router.get("/", listSuppliers);
router.post("/import-csv", importFromCsv);
router.get("/:id", getSupplier);
router.post("/", createSupplier);
router.patch("/:id", updateSupplier);
router.delete("/clear-all", clearSuppliers);
router.delete("/:id", deleteSupplier);

module.exports = router;
