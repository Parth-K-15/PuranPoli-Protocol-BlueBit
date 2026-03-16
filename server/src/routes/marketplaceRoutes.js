const express = require("express");
const {
  listPublished,
  getPublishedDetail,
  previewPublished,
} = require("../controllers/marketplaceController");

const router = express.Router();

router.get("/", listPublished);
router.get("/:id", getPublishedDetail);
router.get("/:id/preview", previewPublished);

module.exports = router;
