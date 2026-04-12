const express = require("express");
const { auth } = require("../../middlewares/auth");
const { addFavourite, unFavourite } = require("./favourite.controller");
const router = express.Router();

router.post("/add", auth(['user']), addFavourite);
router.patch("/unfavourite/:id", auth(['user']), unFavourite);


module.exports = router;