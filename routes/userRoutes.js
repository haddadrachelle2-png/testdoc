const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const userRegisterController = require("../controllers/userRegisterController");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");

router.get("/me", auth, userController.me);

// ⭐ Admin endpoints
router.post("/register", auth, adminOnly, userRegisterController.register);
router.get("/groups", auth,  userRegisterController.listGroups);

module.exports = router;
