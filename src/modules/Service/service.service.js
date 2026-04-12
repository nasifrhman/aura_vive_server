const { default: mongoose } = require("mongoose");
const serviceModel = require("./service.model");
const { WhatsApp } = require("twilio/lib/twiml/VoiceResponse");
const { sub, add } = require("date-fns");
const { default: status } = require("http-status");
const userModel = require("../User/user.model");

const addServiceService = async (data) => {
    return await serviceModel.create(data);
}

const editServiceService = async (id, data) => {
    return await serviceModel.findByIdAndUpdate(id, data, { new: true });
}

const deleteServiceService = async (id) => {
    return await serviceModel.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
}

const disableServiceService = async (id) => {
    return await serviceModel.findByIdAndUpdate(id, { isActive: false }, { new: true });
}

const activeEmployerService = async (id) => {
    return await serviceModel.findByIdAndUpdate(id, { isActive: true }, { new: true });
}



const getAllServiceService = async (options) => {

    const {
        page = 1,
        limit = 10,
        search,
        categoryId,
        subCategoryId,
        status
    } = options;

    const skip = (page - 1) * limit;

    /* ---------------- BASE MATCH ---------------- */

    const matchStage = {
        isDeleted: false
    };

    if (categoryId) {
        matchStage.category =
            new mongoose.Types.ObjectId(String(categoryId));
    }

    if (subCategoryId) {
        matchStage.subCategory =
            new mongoose.Types.ObjectId(String(subCategoryId));
    }

    if (status === "active") matchStage.isActive = true;
    if (status === "inactive") matchStage.isActive = false;

    /* ---------------- PIPELINE ---------------- */

    const pipeline = [

        { $match: matchStage },

        /* provider */
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "providerData"
            }
        },
        { $unwind: { path: "$providerData", preserveNullAndEmptyArrays: true } },

        /* category */
        {
            $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "category"
            }
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },

        /* subcategory */
        {
            $lookup: {
                from: "subcategories",
                localField: "subCategory",
                foreignField: "_id",
                as: "subcategory"
            }
        },
        { $unwind: { path: "$subcategory", preserveNullAndEmptyArrays: true } },

        /* SEARCH */
        ...(search
            ? [{
                $match: {
                    $or: [
                        { name: { $regex: search, $options: "i" } },
                        { "providerData.fullName": { $regex: search, $options: "i" } },
                        { "category.name": { $regex: search, $options: "i" } },
                        { "subcategory.name": { $regex: search, $options: "i" } }
                    ]
                }
            }]
            : []),

        /* BOOKING COUNT */
        {
            $lookup: {
                from: "bookings",
                let: { serviceId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$service", "$$serviceId"] },
                                    { $in: ["$status", ["approved", "completed"]] }
                                ]
                            }
                        }
                    },
                    { $count: "total" }
                ],
                as: "bookingData"
            }
        },

        {
            $addFields: {
                totalBooking: {
                    $ifNull: [
                        { $arrayElemAt: ["$bookingData.total", 0] },
                        0
                    ]
                }
            }
        },

        /* ---------- FACET FOR PERFECT PAGINATION ---------- */

        {
            $facet: {

                data: [
                    {
                        $project: {
                            serviceId: "$_id",
                            serviceName: "$name",
                            categoryName: "$category.name",
                            categoryId: "$category._id",
                            subCategoryName: "$subcategory.name",
                            subCategoryId: "$subcategory._id",
                            providerName: "$providerData.fullName",
                            description: 1,
                            duration: 1,
                            servicefee: 1,
                            included: 1,
                            image: 1,
                            addons: 1,
                            pass: 1,
                            user: 1,
                            isActive: 1,
                            createdAt: 1,
                            totalBooking: 1
                        }
                    },
                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: limit }
                ],

                totalCount: [
                    { $count: "count" }
                ]
            }
        }
    ];

    const result = await serviceModel.aggregate(pipeline);

    const data = result[0].data;
    const totalResults = result[0].totalCount[0]?.count || 0;

    return {
        result: data,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
            limit
        }
    };
};



const getPartnerAllServiceService = async (user, options) => {

    const {
        page = 1,
        limit = 10,
        search,
        categoryId,
        subCategoryId,
        status
    } = options;

    const skip = (page - 1) * limit;

    /* ---------------- BASE MATCH ---------------- */

    const matchStage = {
        isDeleted: false,
        user: new mongoose.Types.ObjectId(String(user))
    };

    if (categoryId) {
        matchStage.category =
            new mongoose.Types.ObjectId(categoryId);
    }

    if (subCategoryId) {
        matchStage.subCategory =
            new mongoose.Types.ObjectId(subCategoryId);
    }

    if (status === "active") matchStage.isActive = true;
    if (status === "inactive") matchStage.isActive = false;

    /* ---------------- PIPELINE ---------------- */

    const pipeline = [

        { $match: matchStage },

        /* PROVIDER */
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "providerData"
            }
        },
        { $unwind: { path: "$providerData", preserveNullAndEmptyArrays: true } },

        /* CATEGORY */
        {
            $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "category"
            }
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },

        /* SUBCATEGORY */
        {
            $lookup: {
                from: "subcategories",
                localField: "subCategory",
                foreignField: "_id",
                as: "subcategory"
            }
        },
        { $unwind: { path: "$subcategory", preserveNullAndEmptyArrays: true } },

        /* ---------------- SEARCH ---------------- */

        ...(search
            ? [{
                $match: {
                    $or: [
                        { name: { $regex: search, $options: "i" } },
                        { "providerData.fullName": { $regex: search, $options: "i" } },
                        { "category.name": { $regex: search, $options: "i" } },
                        { "subcategory.name": { $regex: search, $options: "i" } }
                    ]
                }
            }]
            : []),

        /* ---------------- BOOKING COUNT ---------------- */

        {
            $lookup: {
                from: "bookings",
                let: { serviceId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$service", "$$serviceId"] },
                                    { $in: ["$status", ["approved", "completed"]] }
                                ]
                            }
                        }
                    },
                    { $count: "total" }
                ],
                as: "bookingData"
            }
        },

        {
            $addFields: {
                totalBooking: {
                    $ifNull: [
                        { $arrayElemAt: ["$bookingData.total", 0] },
                        0
                    ]
                }
            }
        },

        /* ---------------- PERFECT PAGINATION ---------------- */

        {
            $facet: {

                data: [
                    {
                        $project: {
                            serviceId: "$_id",
                            serviceName: "$name",
                            categoryName: "$category.name",
                            categoryId: "$category._id",
                            subCategoryName: "$subcategory.name",
                            subCategoryId: "$subcategory._id",
                            providerName: "$providerData.fullName",
                            description: 1,
                            duration: 1,
                            servicefee: 1,
                            included: 1,
                            image: 1,
                            addons: 1,
                            pass: 1,
                            user: 1,
                            isActive: 1,
                            createdAt: 1,
                            totalBooking: 1
                        }
                    },
                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: limit }
                ],

                totalCount: [
                    { $count: "count" }
                ]
            }
        }
    ];

    const result = await serviceModel.aggregate(pipeline);

    const data = result[0].data;
    const totalResults = result[0].totalCount[0]?.count || 0;

    return {
        result: data,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
            limit
        }
    };
};


const aServiceDetailsService = async (id) => {
    return await serviceModel.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(String(id))
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user"
            }
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'partners',
                localField: 'user._id',
                foreignField: 'user',
                as: 'partner'
            }
        },
        { $unwind: { path: "$partner", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from : 'availabilities',
                localField: '_id',
                foreignField: 'service',
                as: 'availability'
            }
        },
        {
            $unwind: {
                path: '$availability',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                name: 1,
                description: 1,
                duration: 1,
                servicefee: 1,
                included: 1,
                image: 1,
                addons: 1,
                pass: 1,
                price: 1,
                userName: "$user.fullName",
                userId: "$user._id",
                phoneNumber: "$user.phoneNumber",
                location: "$user.location",
                address: "$user.address",
                // location: "$partner.location",
                availability: "$availability.slot",
                category: 1,
                subCategory: 1,
                avgRating: 1,
                ratingCount : 1
            }
        }
    ])
}


const popularService = async (loginUserId, options) => {
    console.log({ loginUserId, options });
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const loginUser = await userModel.findById(loginUserId)
        .select("location");

    if (!loginUser?.location) {
        throw new Error("User location not found");
    }

    const [lng, lat] = loginUser.location.coordinates;

    const result = await userModel.aggregate([
        {
            $geoNear: {
                near: {
                    type: "Point",
                    coordinates: [lng, lat]
                },
                distanceField: "distance",
                spherical: true,
                distanceMultiplier: 0.001
            }
        },

        {
            $lookup: {
                from: "services",
                localField: "_id",
                foreignField: "user",
                as: "service"
            }
        },

        { $unwind: "$service" },

        {
            $lookup: {
                from: "subcategories",
                localField: "service.subCategory",
                foreignField: "_id",
                as: "subcategory"
            }
        },

        {
            $unwind: {
                path: "$subcategory",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $match: {
                "service.isDeleted": false,
                "service.isActive": true
            }
        },

        {
            $sort: {
                "service.sell": -1
            }
        },

        {
            $project: {
                _id: "$service._id",
                name: "$service.name",
                subCategoryName: "$subcategory.name",
                sell: "$service.sell",
                image: 1,
                isVerified: 1,
                avgRating: "$service.avgRating",
                ratingCount: "$service.ratingCount",
                servicefee: "$service.servicefee",
                distance: { $round: ["$distance", 2] }
            }
        },

        {
            $facet: {
                result: [
                    { $skip: skip },
                    { $limit: limit }
                ],
                totalCount: [
                    { $count: "count" }
                ]
            }
        }
    ]);

    const services = result[0].result;
    const totalResults = result[0].totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalResults / limit);

    return {
        result: services,
        pagination: {
            totalResults,
            totalPages,
            currentPage: page,
            limit
        }
    };
};


module.exports = {
    addServiceService, editServiceService,
    getPartnerAllServiceService,
    deleteServiceService, activeEmployerService,
    getAllServiceService, aServiceDetailsService, disableServiceService,
    popularService
}