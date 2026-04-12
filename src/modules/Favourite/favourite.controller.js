const { default: status } = require("http-status");
const { unFavouriteService, addFavouriteService, myFavouriteService } = require("./favourite.service");
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");


const addFavourite = catchAsync(async (req, res) => {
  req.body.user = req.User._id;
  const result = await addFavouriteService(req.body)
  return res.status(status.CREATED).json(response({ status: 'Success', statusCode: status.CREATED, type: 'favourite', message: 'favourite-added', data: result }));
});

const unFavourite = catchAsync(async (req, res) => {
  const unfav = await unFavouriteService(req.params.id, req.User._id);
  if(unfav) return res.status(status.OK).json(response({ status: 'Success', statusCode: status.OK, type: 'favourite', message: 'unfavourited', data: unfav }))
  else return res.status(status.BAD_REQUEST).json(response({ status: 'Error', statusCode: status.BAD_REQUEST, type: 'favourite', message: 'unfavourited', data: unfav }))
})

module.exports = { addFavourite, unFavourite };