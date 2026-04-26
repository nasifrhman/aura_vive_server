const { default: mongoose } = require("mongoose");
const transactionModel = require("./transaction.model");
const { options } = require("./transaction.route");

const getAllTransactions = async (option = {}) => {

  let {
    page = 1,
    limit = 10,
    month,
    year,
    payment_method,
    search
  } = option;

  page = Number(page);
  limit = Number(limit);

  const skip = (page - 1) * limit;


  const now = new Date();

  month = Number(month);
  year = Number(year);

  if (!month || !year || isNaN(month) || isNaN(year)) {
    const lastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    month = lastMonth.getMonth() + 1;
    year = lastMonth.getFullYear();
  }


  const matchStage = {
    $match: {
      $expr: {
        $and: [
          { $eq: [{ $month: "$createdAt" }, month] },
          { $eq: [{ $year: "$createdAt" }, year] }
        ]
      }
    }
  };

  if (payment_method) {
    matchStage.$match.payment_method = payment_method;
  }


  const pipeline = [

    matchStage,

    { $sort: { createdAt: -1 } },

    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "userInfo"
      }
    },
    { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "users",
        localField: "partner",
        foreignField: "_id",
        as: "partnerInfo"
      }
    },
    { $unwind: { path: "$partnerInfo", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "services",
        localField: "service",
        foreignField: "_id",
        as: "serviceInfo"
      }
    },
    { $unwind: { path: "$serviceInfo", preserveNullAndEmptyArrays: true } },


    ...(search
      ? [{
        $match: {
          $or: [
            {
              "partnerInfo.fullName": {
                $regex: search,
                $options: "i"
              }
            },
            {
              "userInfo.fullName": {
                $regex: search,
                $options: "i"
              }
            }
          ]
        }
      }]
      : []),

    { $skip: skip },
    { $limit: limit },

    {
      $project: {
        _id: 0,
        amount: "$net_amount",
        booking: 1,
        payment_method: 1,
        createdAt: 1,
        partnerName: "$partnerInfo.fullName",
        userName: "$userInfo.fullName",
        serviceName: "$serviceInfo.name"
      }
    }
  ];


  const countPipeline = [

    matchStage,

    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "userInfo"
      }
    },
    { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "users",
        localField: "partner",
        foreignField: "_id",
        as: "partnerInfo"
      }
    },
    { $unwind: { path: "$partnerInfo", preserveNullAndEmptyArrays: true } },

    ...(search
      ? [{
        $match: {
          $or: [
            { "partnerInfo.fullName": { $regex: search, $options: "i" } },
            { "userInfo.fullName": { $regex: search, $options: "i" } }
          ]
        }
      }]
      : []),

    { $count: "total" }
  ];

  const [result, totalCount] = await Promise.all([
    transactionModel.aggregate(pipeline),
    transactionModel.aggregate(countPipeline)
  ]);

  const totalResults = totalCount[0]?.total || 0;

  return {
    result,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      month,
      year
    }
  };
};

const getPlatformEarningTransactionsService = async (option = {}) => {

  let {
    page = 1,
    limit = 10,
    month,
    year,
    search,
    paymentType,
    role
  } = option;

  page = Number(page);
  limit = Number(limit);

  const skip = (page - 1) * limit;

  const now = new Date();

  month = Number(month) || now.getMonth() + 1;
  year = Number(year) || now.getFullYear();

  // ================= MATCH =================
  const matchConditions = {
    payment_status: "successful",
    $expr: {
      $and: [
        { $eq: [{ $month: "$createdAt" }, month] },
        { $eq: [{ $year: "$createdAt" }, year] }
      ]
    }
  };

  // ================= FILTER: paymentType =================
  if (paymentType) {
    matchConditions.paymentType = paymentType;
  }

  const basePipeline = [
    { $match: matchConditions },

    // USER INFO
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "userInfo"
      }
    },
    { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },

    // PARTNER INFO
    {
      $lookup: {
        from: "users",
        localField: "partner",
        foreignField: "_id",
        as: "partnerInfo"
      }
    },
    { $unwind: { path: "$partnerInfo", preserveNullAndEmptyArrays: true } },

    // ================= CALCULATED FIELDS =================
    {
      $addFields: {

        type: {
          $cond: [
            { $eq: ["$paymentType", "credit"] },
            "credit",
            "commission"
          ]
        },

        amount: {
          $cond: [
            { $eq: ["$paymentType", "credit"] },
            "$net_amount",
            "$commission"
          ]
        },

        roleName: {
          $cond: [
            { $eq: ["$paymentType", "credit"] },
            "$userInfo.role",
            "partner"
          ]
        },

        actorName: {
          $cond: [
            { $eq: ["$paymentType", "credit"] },
            "$userInfo.fullName",
            "$partnerInfo.fullName"
          ]
        }
      }
    }
  ];

  // ================= FILTER: role =================
  if (role) {
    basePipeline.push({
      $match: {
        roleName: role
      }
    });
  }

  // ================= SEARCH =================
  if (search) {
    basePipeline.push({
      $match: {
        $or: [
          { tx_ref: { $regex: search, $options: "i" } },
          { transaction_id: { $regex: search, $options: "i" } },
          { actorName: { $regex: search, $options: "i" } }
        ]
      }
    });
  }

  // ================= RESULT =================
  const resultPipeline = [
    ...basePipeline,

    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },

    {
      $project: {
        _id: 1,
        tx_ref: 1,
        transaction_id: 1,

        amount: 1,
        type: 1,
        roleName: 1,
        actorName: 1,

        paymentType: 1,
        currency: 1,
        payment_method: 1,
        createdAt: 1
      }
    }
  ];

  // ================= COUNT =================
  const countPipeline = [
    ...basePipeline,
    { $count: "total" }
  ];

  const [result, totalCount] = await Promise.all([
    transactionModel.aggregate(resultPipeline),
    transactionModel.aggregate(countPipeline)
  ]);

  return {
    result,
    pagination: {
      totalResults: totalCount[0]?.total || 0,
      totalPages: Math.ceil((totalCount[0]?.total || 0) / limit),
      currentPage: page,
      limit,
      month,
      year
    }
  };
};




const getAllPayoutService = async (option = {}) => {
  let {
    page = 1,
    limit = 10,
    month,
    year,
    status,
    search
  } = option;

  page = Number(page);
  limit = Number(limit);

  const skip = (page - 1) * limit;

  const now = new Date();

  // Default last month
  if (!month || !year || isNaN(month) || isNaN(year)) {
    const lastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    month = lastMonth.getMonth() + 1;
    year = lastMonth.getFullYear();
  }

  month = Number(month);
  year = Number(year);

  const matchStage = {
    $match: {
      $expr: {
        $and: [
          { $eq: [{ $month: "$createdAt" }, month] },
          { $eq: [{ $year: "$createdAt" }, year] }
        ]
      }
    }
  };

  if (status) {
    matchStage.$match.payout_status = status;
  }

  const basePipeline = [
    matchStage,

    {
      $group: {
        _id: {
          partner: "$partner",
          payout_status: "$payout_status"
        },
        // total_gross_amount: { $sum: "$gross_amount" },
        // total_commission: { $sum: "$commission" },
        total_net_amount: { $sum: "$net_amount" },
        // total_transactions: { $sum: 1 }
      }
    },

    //  bank where isManual = false
    {
      $lookup: {
        from: "banks",
        let: { partnerId: "$_id.partner" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$partnerId"] },
                  { $eq: ["$isManual", false] }
                ]
              }
            }
          },
          { $limit: 1 }
        ],
        as: "bankInfo"
      }
    },
    {
      $unwind: {
        path: "$bankInfo",
        preserveNullAndEmptyArrays: true
      }
    },

    {
      $lookup: {
        from: "users",
        localField: "_id.partner",
        foreignField: "_id",
        as: "partnerInfo"
      }
    },
    {
      $unwind: {
        path: "$partnerInfo",
        preserveNullAndEmptyArrays: true
      }
    }
  ];

  if (search) {
    basePipeline.push({
      $match: {
        $or: [
          { "partnerInfo.fullName": { $regex: search, $options: "i" } },
          { "partnerInfo.email": { $regex: search, $options: "i" } },
          { "bankInfo.account_name": { $regex: search, $options: "i" } },
          { "bankInfo.account_number": { $regex: search, $options: "i" } },
          { "bankInfo.bank_name": { $regex: search, $options: "i" } }
        ]
      }
    });
  }

  const resultPipeline = [
    ...basePipeline,

    { $sort: { total_net_amount: -1 } },
    { $skip: skip },
    { $limit: limit },

    {
      $project: {
        _id: 0,

        partnerId: "$partnerInfo._id",
        partnerName: "$partnerInfo.fullName",
        // partnerEmail: "$partnerInfo.email",

        month,
        year,

        payout_status: "$_id.payout_status",

        total_gross_amount: 1,
        total_commission: 1,
        total_net_amount: 1,
        total_transactions: 1,

        bankName: "$bankInfo.bank_name",
        account_name: "$bankInfo.account_name",
        account_number: "$bankInfo.account_number"
      }
    }
  ];

  const countPipeline = [
    ...basePipeline,
    { $count: "total" }
  ];

  const [result, totalCount] = await Promise.all([
    transactionModel.aggregate(resultPipeline),
    transactionModel.aggregate(countPipeline)
  ]);

  const totalResults = totalCount[0]?.total || 0;

  return {
    result,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      month,
      year
    }
  };
};

const getcompletePayoutService = async (option = {}) => {

  let {
    page = 1,
    limit = 10,
    month,
    year,
    status,
    search
  } = option;

  page = Number(page);
  limit = Number(limit);

  const skip = (page - 1) * limit;


  const now = new Date();

  if (!month || !year || isNaN(month) || isNaN(year)) {
    const lastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    month = lastMonth.getMonth() + 1;
    year = lastMonth.getFullYear();
  }

  month = Number(month);
  year = Number(year);


  const matchStage = {
    $match: {
      payout_status: "completed",
      $expr: {
        $and: [
          { $eq: [{ $month: "$createdAt" }, month] },
          { $eq: [{ $year: "$createdAt" }, year] }
        ]
      }
    }
  };

  if (status) {
    matchStage.$match.payout_status = status;
  }


  const basePipeline = [
    matchStage,

    // GROUP BY PARTNER
    {
      $group: {
        _id: "$partner",
        total_gross_amount: { $sum: "$gross_amount" },
        total_commission: { $sum: "$commission" },
        total_net_amount: { $sum: "$net_amount" },
        total_transactions: { $sum: 1 }
      }
    },

    {
      $lookup: {
        from: "banks",
        localField: "_id",
        foreignField: "user",
        as: "bankInfo"
      }
    },
    {
      $unwind: {
        path: "$bankInfo",
        preserveNullAndEmptyArrays: true
      }
    }
  ];


  if (search) {
    basePipeline.push({
      $match: {
        $or: [
          { "bankInfo.account_name": { $regex: search, $options: "i" } },
          { "bankInfo.account_number": { $regex: search, $options: "i" } },
          { "bankInfo.bank_name": { $regex: search, $options: "i" } }
        ]
      }
    });
  }


  const resultPipeline = [
    ...basePipeline,

    { $sort: { total_net_amount: -1 } },
    { $skip: skip },
    { $limit: limit },

    // PARTNER INFO
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "partnerInfo"
      }
    },
    {
      $unwind: {
        path: "$partnerInfo",
        preserveNullAndEmptyArrays: true
      }
    },

    {
      $project: {
        _id: 0,

        partnerId: "$partnerInfo._id",
        partnerName: "$partnerInfo.fullName",
        partnerEmail: "$partnerInfo.email",

        total_gross_amount: 1,
        total_commission: 1,
        total_net_amount: 1,
        total_transactions: 1,

        bankName: "$bankInfo.bank_name",
        account_name: "$bankInfo.account_name",
        account_number: "$bankInfo.account_number"
      }
    }
  ];

  const countPipeline = [
    ...basePipeline,
    { $count: "total" }
  ];


  const [result, totalCount] = await Promise.all([
    transactionModel.aggregate(resultPipeline),
    transactionModel.aggregate(countPipeline)
  ]);

  const totalResults = totalCount[0]?.total || 0;

  return {
    result,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      month,
      year
    }
  };
};


const getPartnerMonthlySummaryService = async (option = {}) => {

  let {
    page = 1,
    limit = 10,
    month,
    year,
    search
  } = option;

  page = Number(page);
  limit = Number(limit);

  const skip = (page - 1) * limit;

  const now = new Date();

  if (!month || !year || isNaN(month) || isNaN(year)) {
    const lastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    month = lastMonth.getMonth() + 1;
    year = lastMonth.getFullYear();
  }

  month = Number(month);
  year = Number(year);

  const matchStage = {
    $match: {
      payout_status: { $in: ["pending", "hold"] },
      $expr: {
        $and: [
          { $eq: [{ $month: "$createdAt" }, month] },
          { $eq: [{ $year: "$createdAt" }, year] }
        ]
      }
    }
  };

  const basePipeline = [
    matchStage,

    // GROUP BY PARTNER + STATUS
    {
      $group: {
        _id: {
          partner: "$partner",
          payout_status: "$payout_status"
        },
        total_gross_amount: { $sum: "$gross_amount" },
        total_commission: { $sum: "$commission" },
        total_net_amount: { $sum: "$net_amount" },
        total_transactions: { $sum: 1 }
      }
    },

    {
      $lookup: {
        from: "users",
        localField: "_id.partner",
        foreignField: "_id",
        as: "partnerInfo"
      }
    },
    {
      $unwind: {
        path: "$partnerInfo",
        preserveNullAndEmptyArrays: true
      }
    },

    //ONLY isManual = false
    {
      $lookup: {
        from: "banks",
        let: { partnerId: "$_id.partner" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$partnerId"] },
                  { $eq: ["$isManual", false] }
                ]
              }
            }
          },
          { $limit: 1 }
        ],
        as: "bankInfo"
      }
    },
    {
      $unwind: {
        path: "$bankInfo",
        preserveNullAndEmptyArrays: true
      }
    }
  ];
  if (search) {
    basePipeline.push({
      $match: {
        $or: [
          { "partnerInfo.fullName": { $regex: search, $options: "i" } },
          { "partnerInfo.email": { $regex: search, $options: "i" } },
          { "bankInfo.account_name": { $regex: search, $options: "i" } },
          { "bankInfo.account_number": { $regex: search, $options: "i" } },
          { "bankInfo.bank_name": { $regex: search, $options: "i" } }
        ]
      }
    });
  }

  const resultPipeline = [
    ...basePipeline,

    { $sort: { "_id.partner": 1, "_id.payout_status": 1 } },
    { $skip: skip },
    { $limit: limit },

    {
      $project: {
        _id: 0,

        partnerId: "$partnerInfo._id",
        partnerName: "$partnerInfo.fullName",
        partnerEmail: "$partnerInfo.email",

        payout_status: "$_id.payout_status",

        total_gross_amount: 1,
        total_commission: 1,
        total_net_amount: 1,
        total_transactions: 1,

        bankName: "$bankInfo.bank_name",
        account_name: "$bankInfo.account_name",
        account_number: "$bankInfo.account_number"
      }
    }
  ];

  const countPipeline = [
    ...basePipeline,
    { $count: "total" }
  ];

  const [result, totalCount] = await Promise.all([
    transactionModel.aggregate(resultPipeline),
    transactionModel.aggregate(countPipeline)
  ]);

  const totalResults = totalCount[0]?.total || 0;

  return {
    result,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      month,
      year
    }
  };
};


const holdPayoutService = async ({
  partnerId,
  month,
  year,
  status
}) => {
  if (!partnerId || !month || !year) {
    throw new Error("partnerId, month and year are required");
  }

  month = Number(month);
  year = Number(year);

  const result = await transactionModel.updateMany(
    {
      partner: new mongoose.Types.ObjectId(String(partnerId)),

      payout_status: "pending",

      $expr: {
        $and: [
          { $eq: [{ $month: "$createdAt" }, month] },
          { $eq: [{ $year: "$createdAt" }, year] }
        ]
      }
    },
    {
      $set: {
        payout_status: 'hold'
      }
    }
  );

  return {
    modifiedCount: result.modifiedCount
  };
};



const getPartnerMonthlyCompletedPayoutService = async (option = {}) => {

  let {
    page = 1,
    limit = 10,
    month,
    year,
    search
  } = option;

  page = Number(page);
  limit = Number(limit);

  const skip = (page - 1) * limit;

  const now = new Date();
  const currentYear = now.getFullYear();

  year = Number(year) || currentYear;

  // ================= MATCH =================
  const matchConditions = {
    payout_status: "completed",
    $expr: {
      $eq: [
        { $year: { $ifNull: ["$payout_completed_at", "$updatedAt"] } },
        year
      ]
    }
  };

  if (month) {
    matchConditions.$expr = {
      $and: [
        {
          $eq: [
            { $month: { $ifNull: ["$payout_completed_at", "$updatedAt"] } },
            Number(month)
          ]
        },
        {
          $eq: [
            { $year: { $ifNull: ["$payout_completed_at", "$updatedAt"] } },
            year
          ]
        }
      ]
    };
  }

  const basePipeline = [
    { $match: matchConditions },

    // GROUP
    {
      $group: {
        _id: {
          partner: "$partner",
          month: {
            $month: { $ifNull: ["$payout_completed_at", "$updatedAt"] }
          },
          year: {
            $year: { $ifNull: ["$payout_completed_at", "$updatedAt"] }
          }
        },
        total_gross_amount: { $sum: "$gross_amount" },
        total_commission: { $sum: "$commission" },
        total_net_amount: { $sum: "$net_amount" },
        total_transactions: { $sum: 1 }
      }
    },

    // PARTNER
    {
      $lookup: {
        from: "users",
        localField: "_id.partner",
        foreignField: "_id",
        as: "partnerInfo"
      }
    },
    {
      $unwind: {
        path: "$partnerInfo",
        preserveNullAndEmptyArrays: true
      }
    },

    // BANK (ONLY isManual = false)
    {
      $lookup: {
        from: "banks",
        let: { partnerId: "$_id.partner" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$partnerId"] },
                  { $eq: ["$isManual", false] }
                ]
              }
            }
          },
          { $limit: 1 }
        ],
        as: "bankInfo"
      }
    },
    {
      $unwind: {
        path: "$bankInfo",
        preserveNullAndEmptyArrays: true
      }
    }
  ];

  // ================= SEARCH (IMPORTANT ADDITION) =================
  if (search) {
    basePipeline.push({
      $match: {
        $or: [
          {
            "partnerInfo.fullName": {
              $regex: search,
              $options: "i"
            }
          },
          {
            "bankInfo.account_name": {
              $regex: search,
              $options: "i"
            }
          },
          {
            "bankInfo.account_number": {
              $regex: search,
              $options: "i"
            }
          }
        ]
      }
    });
  }
  // ================= RESULT =================
  const resultPipeline = [
    ...basePipeline,

    { $sort: { "_id.year": -1, "_id.month": -1 } },
    { $skip: skip },
    { $limit: limit },

    {
      $project: {
        _id: 0,

        month: "$_id.month",
        year: "$_id.year",

        partnerId: "$partnerInfo._id",
        partnerName: "$partnerInfo.fullName",
        partnerEmail: "$partnerInfo.email",

        total_gross_amount: 1,
        total_commission: 1,
        total_net_amount: 1,
        total_transactions: 1,

        bankName: "$bankInfo.bank_name",
        account_name: "$bankInfo.account_name",
        account_number: "$bankInfo.account_number"
      }
    }
  ];

  // ================= COUNT =================
  const countPipeline = [
    ...basePipeline,
    { $count: "total" }
  ];

  const [result, totalCount] = await Promise.all([
    transactionModel.aggregate(resultPipeline),
    transactionModel.aggregate(countPipeline)
  ]);

  return {
    result,
    pagination: {
      totalResults: totalCount[0]?.total || 0,
      totalPages: Math.ceil((totalCount[0]?.total || 0) / limit),
      currentPage: page,
      limit,
      month: month || null,
      year
    }
  };
};


module.exports = {
  getAllTransactions,
  // getPendingPayoutService,
  holdPayoutService,
  getcompletePayoutService,
  getPartnerMonthlySummaryService,
  getPartnerMonthlyCompletedPayoutService,
  getAllPayoutService,
  getPlatformEarningTransactionsService
};
