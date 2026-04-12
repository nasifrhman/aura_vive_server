const express = require("express");
const { addEmployeeController,
     getAllEmployeeController, getEmployeeController,
      editEmployeeController, deleteEmployeeController, 
      suspendEmployeeController, activeEmployeeController, 
      allocateCreditController, 
    getCompanyAllEmployeeController } = require("./employee.controller");
const { auth } = require("../../middlewares/auth");
const router = express.Router();


router.post("/add", auth(['hr','admin']), addEmployeeController);
router.get("/admin/all", getAllEmployeeController);
router.get("/company/all",auth(['hr']), getCompanyAllEmployeeController);
router.get("/details/:id", getEmployeeController);
router.put("/edit/:id", auth(['hr','admin']), editEmployeeController);
// router.put("/allocate-credit/:user", auth(['hr','admin']), allocateCreditController);
router.patch("/suspend/:id", auth(['hr','admin']), suspendEmployeeController);
router.patch("/active/:id", auth(['hr','admin']), activeEmployeeController);
router.patch("/delete/:id", auth(['hr','admin']), deleteEmployeeController);

module.exports = router;