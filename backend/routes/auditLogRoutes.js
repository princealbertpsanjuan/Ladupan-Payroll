const express = require("express");
const router = express.Router();

const { getAuditLogs } = require("../controllers/auditLogController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");

router.get("/", protect, adminOnly, getAuditLogs);

module.exports = router;
