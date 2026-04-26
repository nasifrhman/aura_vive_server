const { default: mongoose } = require("mongoose");
const userModel = require("../User/user.model");
const partnerModel = require("./partner.model");
const { emailWithNodemailer } = require("../../helpers/email");
const ApiError = require("../../helpers/ApiError");
const { default: status } = require("http-status");




const addPartnerService = async (data) => {
    return await partnerModel.create(data);
};


const myDocumentsService = async (userId) => {
    console.log({ userId });

    const result = await partnerModel
        .findOne({ user: userId })
        .select('bankStatement businessCertification identityProof certificate');

    return result;
};


const suspendPartnerService = async (id) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await partnerModel.findByIdAndUpdate(id, { isBan: true }, { new: true }, { session });
        await userModel.findByIdAndUpdate(result.user, { isBan: true }, { session });
        await session.commitTransaction();
        session.endSession();
        return result;
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
}


const giveFlagService = async (id) => {
    const result = await userModel.findByIdAndUpdate(id, { $inc: { flagCount: 1 } }, { new: true });
    return result;
}


const giveNoteService = async (id, note) => {
    const result = await userModel.findByIdAndUpdate(id, { note: note }, { new: true });
    return result;
}

const activePartnerService = async (id) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await partnerModel.findByIdAndUpdate(id, { isBan: false }, { new: true }, { session });
        await userModel.findByIdAndUpdate(result.user, { isBan: false }, { session });
        await session.commitTransaction();
        session.endSession();
        return result;
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
}
const approvePartnerService = async (id) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await partnerModel.findByIdAndUpdate(id, { isVerified: true }, { new: true }, { session });
        await userModel.findByIdAndUpdate(result.user, { isVerified: true }, { session });
        await session.commitTransaction();
        session.endSession();
        return result;
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
}

const updatePartnerService = async (id, data) => {
    return await partnerModel.findByOneAndUpdate({ user: id }, data, { new: true });
}

const aPartnerDetailsService = async (id) => {

    return await partnerModel.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(String(id))
            }
        },

        // USER DATA
        {
            $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userData'
            }
        },
        {
            $unwind: {
                path: '$userData',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'services',
                let: { userId: '$user' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ['$user', '$$userId']
                            }
                        }
                    },

                    {
                        $lookup: {
                            from: 'subcategories',
                            localField: 'subCategory',
                            foreignField: '_id',
                            as: 'subcategoryData'
                        }
                    },
                    {
                        $unwind: {
                            path: '$subcategoryData',
                            preserveNullAndEmptyArrays: true
                        }
                    },

                    {
                        $project: {
                            name: 1,
                            image: 1,
                            ratingCount: 1,
                            avgRating: 1,
                            servicefee: 1,
                            subcategoryName: '$subcategoryData.name'
                        }
                    }
                ],
                as: 'services'
            }
        },
        {
            $project: {
                businessName: 1,
                aboutUs: 1,
                amenities: 1,
                review: 1,
                rating: 1,
                location: '$userData.location',
                address: '$userData.address',
                phoneNumber: '$userData.phoneNumber',
                image: '$userData.image',
                services: 1
            }
        }
    ]);
};

const partnerFeedbackService = async (partnerId, data) => {

    const partner = await partnerModel.findById(partnerId);

    if (!partner) {
        throw new ApiError(status.NOT_FOUND, 'Partner not found');
    }

    const newRating = data.rating;

    if (!newRating) {
        throw new ApiError(status.BAD_REQUEST, 'Rating is required');
    }

    partner.totalRating += newRating;
    partner.ratingCount += 1;

    partner.rating =
        partner.ratingCount > 0
            ? Number(
                (partner.totalRating / partner.ratingCount).toFixed(1)
            )
            : 0;
    partner.review = data.review
    await partner.save();

    return partner;
};


const pendingPartnerForApprovalService = async (options) => {
    const { page = 1, limit = 10, search } = options;
    const skip = (page - 1) * limit;

    // search filter
    const searchMatch = search
        ? {
            $or: [
                { "userData.fullName": { $regex: search, $options: "i" } },
                { "userData.email": { $regex: search, $options: "i" } },
                { "userData.phoneNumber": { $regex: search, $options: "i" } },
                { "categoryData.name": { $regex: search, $options: "i" } },
            ],
        }
        : {};

    const aggregation = [
        {
            $match: {
                isDeleted: false,
                isVerified: false
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData",
            },
        },
        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $match: {
                "userData.role": "partner",
            },
        },
        {
            $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "categoryData",
            },
        },
        {
            $unwind: {
                path: "$categoryData",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $match: searchMatch,
        },

        {
            $sort: { createdAt: -1 },
        },
        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            _id: 1,
                            fullName: "$userData.fullName",
                            phoneNumber: "$userData.phoneNumber",
                            location: "$userData.location",
                            address: "$userData.address",
                            // whatsappNumber: "$userData.whatsappNumber",
                            email: "$userData.email",
                            categoryName: "$categoryData.name",
                            // location: 1,
                            // address: 1,
                            createdAt: 1,
                        },
                    },
                ],
                totalCount: [{ $count: "total" }],
            },
        },
    ];

    const result = await partnerModel.aggregate(aggregation);

    const data = result[0].data;
    const totalResults = result[0].totalCount[0]?.total || 0;

    return {
        result: data,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
        },
    };
};


const allPartnerService = async (options) => {
    const { page = 1, limit = 10, search, isBan } = options;
    const skip = (page - 1) * limit;

    const searchMatch = search
        ? {
            $or: [
                { "userData.fullName": { $regex: search, $options: "i" } },
                { "userData.email": { $regex: search, $options: "i" } },
                { "userData.phoneNumber": { $regex: search, $options: "i" } },
                { "categoryData.name": { $regex: search, $options: "i" } }
            ],
        }
        : {};

    const banMatch =
        isBan !== undefined
            ? { "userData.isBan": isBan === "true" }
            : {};

    const aggregation = [
        {
            $match: {
                isDeleted: false
            },
        },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData",
            },
        },
        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $match: {
                "userData.role": "partner",
                ...banMatch
            },
        },

        {
            $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "categoryData",
            },
        },
        {
            $unwind: {
                path: "$categoryData",
                preserveNullAndEmptyArrays: true,
            },
        },

        { $match: searchMatch },

        { $sort: { createdAt: -1 } },

        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            _id: 1,
                            fullName: "$userData.fullName",
                            Image: "$userData.image",
                            phoneNumber: "$userData.phoneNumber",
                            // whatsappNumber: "$userData.whatsappNumber",
                            email: "$userData.email",
                            categoryName: "$categoryData.name",
                            location: 1,
                            address: 1,
                            rating: 1,
                            isBanned: "$userData.isBan",
                            totalRevenue: "$userData.totalRevenue",
                            totalBookings: 1,
                            completeBookings: 1,
                            createdAt: 1,
                        },
                    },
                ],
                totalCount: [{ $count: "total" }],
            },
        },
    ];

    const result = await partnerModel.aggregate(aggregation);

    const data = result[0].data;
    const totalResults = result[0].totalCount[0]?.total || 0;

    return {
        result: data,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
        },
    };
};



const rejectProviderService = async (id, data) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const partner = await partnerModel.findById(id).session(session);

        if (!partner) {
            throw new Error("Partner not found");
        }
        await partnerModel.findByIdAndDelete(id).session(session);
        const user = await userModel
            .findByIdAndDelete(partner.user)
            .session(session);

        await session.commitTransaction();
        session.endSession();

        if (user?.email) {
            await emailWithNodemailer({
                email: user.email,
                subject: "Partner Application Rejected",
                html: `
                    <h3>Application Rejected</h3>
                    <p>We regret to inform you that your partner application has been rejected.</p>
                    <p><strong>Reason:</strong> ${data.reason}</p>
                    <p>Please contact our support team for more information.</p>
                `,
            });
        }

        return partner;

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
};


const detailsForAdminService = async (userId) => {
    return await partnerModel.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(String(userId))
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData",
            },
        },
        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true,
            },
        },

        {
            $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "categoryData",
            },
        },
        {
            $unwind: {
                path: "$categoryData",
                preserveNullAndEmptyArrays: true,
            },
        },

        {
            $addFields: {
                completionRate: {
                    $cond: [
                        { $eq: ["$totalBookings", 0] },
                        0,
                        {
                            $round: [
                                {
                                    $multiply: [
                                        {
                                            $divide: [
                                                "$completeBookings",
                                                "$totalBookings"
                                            ]
                                        },
                                        100
                                    ]
                                },
                                2
                            ]
                        }
                    ]
                }
            }
        },

        {
            $project: {
                _id: 1,
                businessName: 1,
                fullName: "$userData.fullName",
                phoneNumber: "$userData.phoneNumber",
                // whatsappNumber: "$userData.whatsappNumber",
                wallet: "$userData.wallet",
                image: "$userData.image",
                email: "$userData.email",
                note: "$userData.note",
                categoryName: "$categoryData.name",
                businessCertification: 1,
                identityProof: 1,
                rating: 1,
                totalBookings: 1,
                completeBookings: 1,
                completionRate: 1,
                isBan: 1,
                totalRevenue: "$userData.totalRevenue",
                reportCount: "$userData.reportCount",
                flagCount: "$userData.flagCount",
                certificate: 1,
                bankStatement: 1,
                location: 1,
                address: 1,
                createdAt: 1,
            }
        }
    ]);
};


module.exports = {
    addPartnerService,
    myDocumentsService,
    allPartnerService,
    pendingPartnerForApprovalService,
    detailsForAdminService,
    activePartnerService,
    suspendPartnerService,
    giveFlagService,
    giveNoteService,
    rejectProviderService,
    approvePartnerService,
    updatePartnerService,
    partnerFeedbackService,
    aPartnerDetailsService
};