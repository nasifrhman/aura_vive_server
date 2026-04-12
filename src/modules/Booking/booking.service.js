const { default: mongoose } = require("mongoose");
const serviceModel = require("../Service/service.model");
const bookingModel = require("./booking.model");
const { default: status } = require("http-status");
const ApiError = require("../../helpers/ApiError");
const generate4DigitPin = require("../../helpers/generatepin");
const Api = require("twilio/lib/rest/Api");
const feedbackModel = require("../FeedBack/feedback.model");




const bookingService = async (data) => {
    const service = await serviceModel.findById(data.service);

    if (!data.isOneTime) {
        data.sessionLeft = service.pass.noOfSessions;
        data.expireDate = new Date(
            new Date(data.date).getTime() +
            service.pass.validity * 24 * 60 * 60 * 1000
        );
    }

    if (data.isOneTime) {
        data.sessionLeft = 1;
        data.expireDate = new Date(
            new Date(data.date).getTime() +
            1 * 24 * 60 * 60 * 1000
        );
    }
    data.pin = generate4DigitPin();

    const booking = await bookingModel.create(data);
    return booking;
};


const markAsCompletedService = async (id, data) => {
    const booking = await bookingModel.findById(id);
    if (booking.pin == data.pin && booking.status == "approved") {
        if (booking.sessionLeft <= 0) {
            throw new ApiError(status.BAD_REQUEST, 'No sessions left in this booking');
        }
        booking.sessionLeft -= 1;
        booking.checkin = new Date();
        if(booking.sessionLeft == 0){
            booking.status = "completed";
        }
        await booking.save();
        return true
    }
    else {
        throw new ApiError(status.BAD_REQUEST, 'Pin not matched');
    }
}


const bookingFeedbackService = async (id, data) => {
    const feedback = await feedbackModel.findOne({ booking: id, sender: data.user });
    if(feedback){
        throw new ApiError(status.BAD_REQUEST, 'You already give feedback');
    }

    // Get booking
    const booking = await bookingModel.findById(id);

    if (!booking) {
        throw new ApiError(status.NOT_FOUND, 'Booking not found');
    }

    await feedbackModel.create({
        sender: data.user,
        targetUser: data.targetUser,
        booking: id,
        rating: data.rating,
        text: data.review,
        isAppFeedback: false
    })

    const service = await serviceModel.findById(booking.service);

    if (!service) {
        throw new ApiError(status.NOT_FOUND, 'Service not found');
    }

    const newRating = data.rating;

    // First time rating only
    if (newRating) {
        service.totalRating += newRating;
        service.ratingCount += 1;
    }

    // Calculate average
    service.avgRating =
        service.ratingCount > 0
            ? service.totalRating / service.ratingCount
            : 0;

    await service.save();

    return true;
};


const approveBookingService = async (id) => {
    const result = await bookingModel.findOneAndUpdate(
        { _id: id, status: "pending" },
        { status: "approved" },
        { new: true }
    );
    if (!result) {
        throw new ApiError(status.NOT_FOUND, 'Booking not found');
    }
    return result;
}

const assignStuffService = async (id, stuff) => {
    return await bookingModel.findByIdAndUpdate(id, { assignedTo: stuff }, { new: true });
}

const completeBookingService = async (id) => {
    const updatedBooking = await bookingModel.findOneAndUpdate(
        {
            _id: id,
            status: "approved"
        },
        {
            status: "completed"
        },
        {
            new: true
        }
    );

    if (!updatedBooking) {
        throw new ApiError(status.NOT_FOUND, 'Booking not found');
    }
    return updatedBooking;
}

const bookingDetailsService = async (id, loginUserId) => {

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new Error("Invalid booking id");
    }

    if (!loginUserId || !mongoose.Types.ObjectId.isValid(loginUserId)) {
        throw new Error("Invalid user id");
    }

    const objectBookingId = new mongoose.Types.ObjectId(id);
    const objectUserId = new mongoose.Types.ObjectId(loginUserId);

    const result = await bookingModel.aggregate([
        {
            $match: {
                _id: objectBookingId
            }
        },

        {
            $lookup: {
                from: 'services',
                localField: 'service',
                foreignField: '_id',
                as: 'serviceData'
            }
        },
        {
            $unwind: {
                path: '$serviceData',
                preserveNullAndEmptyArrays: true
            }
        },

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
                from: 'partners',
                localField: 'serviceData.user',
                foreignField: 'user',
                as: 'partnerData'
            }
        },
        {
            $unwind: {
                path: '$partnerData',
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: 'feedbacks',
                localField: '_id',
                foreignField: 'booking',
                as: 'feedbackData'
            }
        },
{
    $addFields: {
        myFeedback: {
            $arrayElemAt: [
                {
                    $map: {
                        input: {
                            $filter: {
                                input: "$feedbackData",
                                as: "fb",
                                cond: { $eq: ["$$fb.sender", objectUserId] }
                            }
                        },
                        as: "fb",
                        in: {
                            text: "$$fb.text",
                            rating: "$$fb.rating"
                        }
                    }
                },
                0
            ]
        },

        oppositeFeedback: {
            $arrayElemAt: [
                {
                    $map: {
                        input: {
                            $filter: {
                                input: "$feedbackData",
                                as: "fb",
                                cond: { $ne: ["$$fb.sender", objectUserId] }
                            }
                        },
                        as: "fb",
                        in: {
                            text: "$$fb.text",
                            rating: "$$fb.rating"
                        }
                    }
                },
                0
            ]
        }
    }
},

        {
            $project: {
                bookingId: '$_id',
                serviceName: '$serviceData.name',
                serviceId: '$serviceData._id',
                endTime: 1,
                startTime: 1,
                providerName: '$userData.fullName',
                phoneNumber: '$userData.phoneNumber',
                location: '$userData.location',
                address: '$userData.address',
                servicePrice: 1,
                totalPrice: 1,
                sessionLeft: 1,
                date: 1,
                pin: 1,
                status: 1,
                isOneTime: 1,
                createdAt: 1,
                myFeedback: 1,
                oppositeFeedback: 1
            }
        }
    ]);

    return result[0] || null;
};


const bookingDetailsAdminEndService = async (id) => {
    const result = await bookingModel.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(String(id))
            }
        },
        {
            $lookup: {
                from: 'services',
                localField: 'service',
                foreignField: '_id',
                as: 'serviceData'
            }
        },
        {
            $unwind: {
                path: '$serviceData',
                preserveNullAndEmptyArrays: true
            }
        },
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
        // FIXED: Partner Lookup - Using pipeline to prevent multiple results
        {
            $lookup: {
                from: 'partners',
                let: { serviceUserId: '$serviceData.user' },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ['$user', '$$serviceUserId'] }
                        }
                    },
                    { $limit: 1 }                    // ← This prevents duplicate documents
                ],
                as: 'partnerData'
            }
        },
        {
            $unwind: {
                path: '$partnerData',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'assignedTo',
                foreignField: '_id',
                as: 'assignedToData'
            }
        },
        {
            $unwind: {
                path: '$assignedToData',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                bookingId: '$_id',
                serviceName: '$serviceData.name',
                serviceId: '$serviceData._id',
                userName: '$userData.fullName',
                userImage: '$userData.image',
                userPhone: '$userData.phoneNumber',
                phoneNumber: '$userData.phoneNumber',
                assignedStaff: '$assignedToData.fullName',
                addons: 1,
                servicefee: '$serviceData.servicefee',
                duration: '$serviceData.duration',
                totalPrice: 1,
                rating: 1,
                review: 1,
                sessionLeft: 1,
                date: 1,
                pin: 1,
                status: 1,
                isOneTime: 1,
                pass: 1,
                createdAt: 1,
                // Optional: Add partner info if needed
                // partnerName: '$partnerData.name',     // uncomment if you need
                // partnerId: '$partnerData._id'
            }
        }
    ]);

    return result[0] || null;   // ← Return single object instead of array
};


const pendingBookingService = async (user, option) => {
    const { page, limit } = option;
    const skip = (page - 1) * limit;
    const [result, total] = await Promise.all([
        bookingModel.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(String(user)),
                    status: "approved",
                    paymentStatus: "paid"
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            },
            {
                $lookup: {
                    from: 'services',
                    localField: 'service',
                    foreignField: '_id',
                    as: 'serviceData'
                }
            },
            {
                $unwind: {
                    path: '$serviceData',
                    preserveNullAndEmptyArrays: true
                }
            },
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
                $project: {
                    image: '$serviceData.image',
                    serviceName: '$serviceData.name',
                    serviceId: '$serviceData._id',
                    providerName: '$userData.fullName',
                    sessionLeft: 1,
                    date: 1,
                    startTime: 1,
                    endTime: 1,
                    createdAt: 1
                }
            }
        ]),
        bookingModel.countDocuments({
            user: new mongoose.Types.ObjectId(String(user)),
            status: "approved",
            paymentStatus: "paid"
        })
    ])
    return { result, pagination: { totalResults: total, totalPages: Math.ceil(total / limit), currentPage: page, limit } }
}



const allPendingBookingService = async (user, option) => {

    const { page, limit, search, isOneTime } = option;
    const skip = (page - 1) * limit;

    const matchStage = {
        provider: new mongoose.Types.ObjectId(String(user)),
        status: "pending",
        paymentStatus: "paid"
    };

    if (isOneTime !== undefined) {
        matchStage.isOneTime = isOneTime === "true";
    }

    let searchMatch = {};

    if (search) {
        searchMatch = {
            $or: [
                { "userData.phoneNumber": { $regex: search, $options: "i" } },
                { "userData.fullName": { $regex: search, $options: "i" } },
                { "serviceData.name": { $regex: search, $options: "i" } }
            ]
        };
    }

    const pipeline = [

        { $match: matchStage },

        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },
        { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },
        { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },

        ...(search ? [{ $match: searchMatch }] : []),

        { $sort: { createdAt: -1 } },

        { $skip: skip },
        { $limit: limit },

        {
            $project: {
                serviceName: "$serviceData.name",
                serviceId: "$serviceData._id",
                userName: "$userData.fullName",
                phoneNumber: "$userData.phoneNumber",
                date: 1,
                startTime: 1,
                endTime: 1,
                isOneTime: 1,
                createdAt: 1
            }
        }
    ];

    const [result, totalCount] = await Promise.all([
        bookingModel.aggregate(pipeline),

        bookingModel.aggregate([
            { $match: matchStage },
            {
                $lookup: {
                    from: "services",
                    localField: "service",
                    foreignField: "_id",
                    as: "serviceData"
                }
            },
            { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },

            ...(search ? [{ $match: searchMatch }] : []),

            { $count: "total" }
        ])
    ]);

    const total = totalCount[0]?.total || 0;

    return {
        result,
        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};


const allBookingService = async (option) => {

    const { page, limit, search, isOneTime, status } = option;
    const skip = (page - 1) * limit;

    const matchStage = {
        status: status,
        paymentStatus: "paid"
    };

    if (isOneTime !== undefined) {
        matchStage.isOneTime = isOneTime === "true";
    }

    let searchMatch = {};

    if (search) {
        searchMatch = {
            $or: [
                { "userData.phoneNumber": { $regex: search, $options: "i" } },
                { "userData.fullName": { $regex: search, $options: "i" } },
                { "providerData.fullName": { $regex: search, $options: "i" } },
                { "serviceData.name": { $regex: search, $options: "i" } }
            ]
        };
    }

    const pipeline = [

        { $match: matchStage },

        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },
        { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "users",
                localField: "serviceData.user",
                foreignField: "_id",
                as: "providerData"
            }
        },
        {
            $unwind: { path: "$providerData", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },
        { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },

        ...(search ? [{ $match: searchMatch }] : []),

        { $sort: { createdAt: -1 } },

        { $skip: skip },
        { $limit: limit },

        {
            $project: {
                serviceName: "$serviceData.name",
                serviceId: "$serviceData._id",
                userName: "$userData.fullName",
                phoneNumber: "$userData.phoneNumber",
                providerName: "$providerData.fullName",
                totalPrice: 1,
                paymentMethod: 1,
                isOneTime: 1,
                status: 1,
                createdAt: 1
            }
        }
    ];

    const [result, totalCount] = await Promise.all([
        bookingModel.aggregate(pipeline),

        bookingModel.aggregate([
            { $match: matchStage },
            {
                $lookup: {
                    from: "services",
                    localField: "service",
                    foreignField: "_id",
                    as: "serviceData"
                }
            },
            { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },

            ...(search ? [{ $match: searchMatch }] : []),

            { $count: "total" }
        ])
    ]);

    const total = totalCount[0]?.total || 0;

    return {
        result,
        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};


const allActiveBookingService = async (user, option) => {

    const { page, limit, search, isOneTime } = option;

    const skip = (page - 1) * limit;
    const now = new Date();

    const matchStage = {
        provider: new mongoose.Types.ObjectId(String(user)),
        status: "approved",
        paymentStatus: "paid",
        $expr: {
            $and: [
                { $lte: ["$date", now] },
                { $gte: ["$expireDate", now] }
            ]
        }
    };

    if (isOneTime !== undefined) {
        matchStage.isOneTime = isOneTime === "true";
    }

    let searchMatch = {};

    if (search) {
        searchMatch = {
            $or: [
                { "serviceData.name": { $regex: search, $options: "i" } },
                { "userData.fullName": { $regex: search, $options: "i" } },
                { phoneNumberString: { $regex: search, $options: "i" } },
                { "assignedToData.fullName": { $regex: search, $options: "i" } }
            ]
        };
    }

    const pipeline = [

        { $match: matchStage },

        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },
        { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },
        { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: "users",
                localField: "assignedTo",
                foreignField: "_id",
                as: "assignedToData"
            }
        },
        { $unwind: { path: "$assignedToData", preserveNullAndEmptyArrays: true } },

        {
            $addFields: {
                phoneNumberString: { $toString: "$userData.phoneNumber" }
            }
        },

        ...(search ? [{ $match: searchMatch }] : []),

        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
            $project: {
                name: "$serviceData.image",
                serviceName: "$serviceData.name",
                serviceId: "$serviceData._id",
                userName: "$userData.fullName",
                phoneNumber: "$userData.phoneNumber",
                assignedStaff: "$assignedToData.fullName",
                isOneTime: 1,
                startTime: 1,
                endTime: 1,
                date: 1,
                checkin: 1,
                createdAt: 1,

            }
        }
    ];

    const [result, totalCount] = await Promise.all([
        bookingModel.aggregate(pipeline),

        bookingModel.aggregate([
            { $match: matchStage },

            {
                $lookup: {
                    from: "services",
                    localField: "service",
                    foreignField: "_id",
                    as: "serviceData"
                }
            },
            { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: "users",
                    localField: "assignedTo",
                    foreignField: "_id",
                    as: "assignedToData"
                }
            },
            { $unwind: { path: "$assignedToData", preserveNullAndEmptyArrays: true } },

            {
                $addFields: {
                    phoneNumberString: { $toString: "$userData.phoneNumber" }
                }
            },

            ...(search ? [{ $match: searchMatch }] : []),

            { $count: "total" }
        ])
    ]);

    const total = totalCount[0]?.total || 0;

    return {
        result,
        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};


const allCompletedBookingService = async (user, option) => {

    const { page = 1, limit = 10, search, isOneTime } = option;

    const skip = (page - 1) * limit;
    const now = new Date();

    const matchStage = {
        provider: new mongoose.Types.ObjectId(String(user)),
        status: "completed",
        paymentStatus: "paid",
        // expireDate: { $lt: now }
    };
    if (isOneTime !== undefined) {
        matchStage.isOneTime = isOneTime === "true";
    }

    let searchMatch = {};

    if (search) {
        searchMatch = {
            $or: [
                { "serviceData.name": { $regex: search, $options: "i" } },
                { "userData.fullName": { $regex: search, $options: "i" } },
                { phoneNumberString: { $regex: search, $options: "i" } },
                { "assignedToData.fullName": { $regex: search, $options: "i" } }
            ]
        };
    }

    const pipeline = [

        { $match: matchStage },
        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },
        { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },
        { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: "users",
                localField: "assignedTo",
                foreignField: "_id",
                as: "assignedToData"
            }
        },
        { $unwind: { path: "$assignedToData", preserveNullAndEmptyArrays: true } },
        {
            $addFields: {
                phoneNumberString: { $toString: "$userData.phoneNumber" }
            }
        },
        ...(search ? [{ $match: searchMatch }] : []),

        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
            $project: {
                name: "$serviceData.image",
                serviceName: "$serviceData.name",
                serviceId: "$serviceData._id",
                userName: "$userData.fullName",
                phoneNumber: "$userData.phoneNumber",
                assignedStaff: "$assignedToData.fullName",
                isOneTime: 1,
                date: 1,
                startTime: 1,
                endTime: 1,
                checkin: 1,
                createdAt: 1,
                review: 1,
                rating: 1
            }
        }
    ];

    const [result, totalCount] = await Promise.all([

        bookingModel.aggregate(pipeline),

        bookingModel.aggregate([
            { $match: matchStage },

            {
                $lookup: {
                    from: "services",
                    localField: "service",
                    foreignField: "_id",
                    as: "serviceData"
                }
            },
            { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: "users",
                    localField: "assignedTo",
                    foreignField: "_id",
                    as: "assignedToData"
                }
            },
            { $unwind: { path: "$assignedToData", preserveNullAndEmptyArrays: true } },

            {
                $addFields: {
                    phoneNumberString: { $toString: "$userData.phoneNumber" }
                }
            },

            ...(search ? [{ $match: searchMatch }] : []),

            { $count: "total" }
        ])
    ]);

    const total = totalCount[0]?.total || 0;

    return {
        result,
        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};


const allCancelledBookingService = async (user, option) => {

    const { page, limit, search } = option;

    const skip = (page - 1) * limit;
    const matchStage = {
        provider: new mongoose.Types.ObjectId(String(user)),
        status: "rejected" // cancelled booking
    };
    let searchMatch = {};

    if (search) {
        searchMatch = {
            $or: [
                { "serviceData.name": { $regex: search, $options: "i" } },
                { "userData.fullName": { $regex: search, $options: "i" } },
                { phoneNumberString: { $regex: search, $options: "i" } }
            ]
        };
    }

    const pipeline = [

        { $match: matchStage },
        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },
        { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },
        { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },
        {
            $addFields: {
                phoneNumberString: { $toString: "$userData.phoneNumber" }
            }
        },

        ...(search ? [{ $match: searchMatch }] : []),

        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
            $project: {
                name: "$serviceData.image",
                serviceName: "$serviceData.name",
                serviceId: "$serviceData._id",
                userName: "$userData.fullName",
                phoneNumber: "$userData.phoneNumber",
                date: 1,
                startTime: 1,
                endTime: 1,
                addons: 1,
                updatedAt: 1
            }
        }
    ];

    const [result, totalCount] = await Promise.all([

        bookingModel.aggregate(pipeline),

        bookingModel.aggregate([
            { $match: matchStage },

            {
                $lookup: {
                    from: "services",
                    localField: "service",
                    foreignField: "_id",
                    as: "serviceData"
                }
            },
            { $unwind: "$serviceData" },

            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            { $unwind: "$userData" },

            {
                $addFields: {
                    phoneNumberString: { $toString: "$userData.phoneNumber" }
                }
            },

            ...(search ? [{ $match: searchMatch }] : []),

            { $count: "total" }
        ])
    ]);

    const total = totalCount[0]?.total || 0;

    return {
        result,
        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};



const activeBookingService = async (user, option) => {
    const { page, limit } = option;
    const skip = (page - 1) * limit;

    const now = new Date();

    const [result, total] = await Promise.all([
        bookingModel.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(String(user)),
                    status: "approved",
                    paymentStatus: "paid",
                    $expr: {
                        $and: [
                            { $lte: ["$date", now] },       // booking started
                            { $gte: ["$expireDate", now] }  // not expired
                        ]
                    }
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: "services",
                    localField: "service",
                    foreignField: "_id",
                    as: "serviceData"
                }
            },
            {
                $unwind: {
                    path: "$serviceData",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            {
                $unwind: {
                    path: "$userData",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    image: 1,
                    name: "$serviceData.image",
                    serviceName: "$serviceData.name",
                    serviceId: "$serviceData._id",
                    providerName: '$userData.fullName',
                    sessionLeft: 1,
                    date: 1,
                    startTime: 1,
                    endTime: 1,
                    createdAt: 1
                }
            }
        ]),

        bookingModel.countDocuments({
            user: new mongoose.Types.ObjectId(String(user)),
            status: "approved",
            paymentStatus: "paid",
            $expr: {
                $and: [
                    { $lte: ["$date", now] },       // booking started
                    { $gte: ["$expireDate", now] }  // not expired
                ]
            }
        })
    ]);

    return {
        result,
        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};


const pastBookingService = async (user, option) => {
    const { page, limit } = option;
    const skip = (page - 1) * limit;

    const now = new Date();

    const [result, total] = await Promise.all([
        bookingModel.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(String(user)),
                    status: { $in: ["completed", "approved"] },
                    paymentStatus: "paid",
                    expireDate: { $lt: now }
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: "services",
                    localField: "service",
                    foreignField: "_id",
                    as: "serviceData"
                }
            },
            {
                $unwind: {
                    path: "$serviceData",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            {
                $unwind: {
                    path: "$userData",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    image: 1,
                    name: "$serviceData.image",
                    serviceName: "$serviceData.name",
                    serviceId: "$serviceData._id",
                    providerName: '$userData.fullName',
                    sessionLeft: 1,
                    date: 1,
                    startTime: 1,
                    endTime: 1,
                    createdAt: 1
                }
            }
        ]),

        bookingModel.countDocuments({
            user: new mongoose.Types.ObjectId(String(user)),
            status: { $in: ["completed", "approved"] },
            paymentStatus: "paid",
            expireDate: { $lt: now }
        })
    ]);

    return {
        result,
        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};


module.exports = {
    bookingService,
    pendingBookingService,
    activeBookingService,
    pastBookingService,
    bookingDetailsService,
    allPendingBookingService,
    bookingFeedbackService,
    allActiveBookingService,
    allCompletedBookingService,
    allCancelledBookingService,
    bookingDetailsAdminEndService,
    approveBookingService,
    completeBookingService,
    allBookingService,
    assignStuffService,
    markAsCompletedService
}