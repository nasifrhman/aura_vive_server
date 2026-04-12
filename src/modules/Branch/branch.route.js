const express = require("express");
const { addBranchController, deleteBranchController, getBranchController, updateBranchController } = require("./branch.controller");
const { auth } = require("../../middlewares/auth");
const router = express.Router();

router.post("/add", auth(['hr']), addBranchController);
router.get("/all", getBranchController);
router.put("/edit/:id", auth(['hr']), updateBranchController);
router.patch("/delete/:id", auth(['hr']), deleteBranchController);

module.exports = router;