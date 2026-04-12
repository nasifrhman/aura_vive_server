const express = require("express");
const { addEmployerController, getEmployerController, editEmployerController, deleteEmployerController, getAllEmployerController, suspendEmployerController, activeEmployerController } = require("./employer.controller");
const { auth } = require("../../middlewares/auth");
const router = express.Router();

router.post("/add", auth(['admin']), addEmployerController);
router.get("/admin/all", getAllEmployerController);
router.get("/:id", getEmployerController)
router.put("/edit/:id", auth(['admin']), editEmployerController);
router.patch("/suspend/:id", auth(['admin']), suspendEmployerController); 
router.patch("/active/:id", auth(['admin']), activeEmployerController); 
router.patch("/deleted/:id", auth(['admin']), deleteEmployerController); 

module.exports = router;