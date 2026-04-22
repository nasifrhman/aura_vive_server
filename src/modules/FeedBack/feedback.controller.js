const catchAsync = require("../../helpers/catchAsync");
const { addFeedback, getFeedbackService, getFeedbackForAService, ratingForServiceService, getMyFeedbackService, replyService } = require("./feedback.service");
const response = require("../../helpers/response");
const { default: status } = require("http-status");


const addFeedbackController = catchAsync(async (req, res) => {
    req.body.sender = req.User._id;
    const feedback = await addFeedback(req.body);
    return res.status(status.CREATED).json(response({ status: "success", statusCode: status.CREATED, type: "feedback", message:"feedback-added", data: feedback }));
});

const replyController = catchAsync(async (req, res) => {
    const feedback = await replyService(req.body);
    return res.status(status.CREATED).json(response({ status: "success", statusCode: status.CREATED, type: "feedback", message:"reply-added" }));
});


const getMyFeedbackController = catchAsync(async (req, res) => {
  const options = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
    rating: req.query.rating, 
    date: req.query.date      
  };

  const feedback = await getMyFeedbackService(req.User._id, options);
  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "feedback",
      message: "Feedback fetched successfully",
      data: feedback
    })
  );
});





module.exports = { addFeedbackController, getMyFeedbackController, replyController };