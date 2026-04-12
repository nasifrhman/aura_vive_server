const Feedback = require("./feedback.model");



const addFeedback = async (data) => {
  return Feedback.create(data);
};





const getFeedbackService = async (options) => {
  const { page = 1, limit = 10, rating, date } = options;
  const skip = (page - 1) * limit;
  const sortOption = {};
  if (rating) sortOption.rating = rating === 'asc' ? 1 : -1;
  if (date) sortOption.createdAt = date === 'asc' ? 1 : -1;

  const result = await Feedback.aggregate([
    {
      $lookup: {
        from: "users", 
        localField: "sender",
        foreignField: "_id",
        as: "sender"
      }
    },
    {
      $unwind: {
        path: "$sender",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        text: 1,
        rating: 1,
        createdAt: 1,
        senderName : "$sender.fullName",
        senderImage : "$sender.image",
        senderEmail : "$sender.email",
        senderId : "$sender._id"
      }
    },
    {
      $sort: Object.keys(sortOption).length ? sortOption : { createdAt: -1 }
    },

    {
      $facet: {
        feedback: [
          { $skip: skip },
          { $limit: Number(limit) }
        ],
        totalCount: [
          { $count: "count" }
        ]
      }
    }
  ]);

  const feedback = result[0].feedback;
  const totalResults = result[0].totalCount[0]?.count || 0;
  const totalPages = Math.ceil(totalResults / limit);

  return {
    feedback,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      totalPages,
      totalResults,
      currentPage: Number(page)
    }
  };
}



module.exports = { addFeedback, getFeedbackService };