const express = require("express");
const { auth } = require("../../middlewares/auth");
const { addDepartmentController , getDepartmentController, updateDepartmentController, deleteDepartmentController} = require("./department.controller");
const router = express.Router();

router.post("/add", auth(['hr']), addDepartmentController);
router.get("/all", auth(['hr']), getDepartmentController);
router.put("/edit/:id", auth(['hr']), updateDepartmentController);
router.patch("/delete/:id", auth(['hr']), deleteDepartmentController);

module.exports = router;