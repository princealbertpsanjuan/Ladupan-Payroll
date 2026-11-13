const express = require("express");
const router = express.Router();

const {
  register,
  login,
  getMe,
  changePassword,
  changeEmail,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);

router.get("/me", protect, getMe);
router.put("/change-password", protect, changePassword);
router.put("/change-email", protect, changeEmail);

module.exports = router;
