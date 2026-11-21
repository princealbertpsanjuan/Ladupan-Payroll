const express = require("express");
const router = express.Router();
const { pair, heartbeat } = require("../controllers/shopDeviceController");

// Used by the shop phone/tablet (no user login; pairing code / device token)
router.post("/pair", pair);
router.post("/heartbeat", heartbeat);

module.exports = router;
