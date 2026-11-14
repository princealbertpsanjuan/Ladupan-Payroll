const express = require("express");
const router = express.Router();

const {
  register,
  login,
  getMe,
  changePassword,
  changeEmail,
  changeName,
} = require("../controllers/authController");

const { protect, adminOnly } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);

router.get("/me", protect, getMe);
router.put("/change-password", protect, changePassword);
router.put("/change-email", protect, changeEmail);
router.put("/change-name", protect, adminOnly, changeName);

module.exports = router;
