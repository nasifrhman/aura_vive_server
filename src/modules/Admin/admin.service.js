const { addUser } = require("../Auth/auth.service");
const { userDeleteByIdService } = require("../User/user.service");
const adminModel = require("./admin.model");



const addAdminService = async (data) => {
    const user = await addUser({
        fullName: data.fullName,
        email: data.email,
        password: process.env.DEFAULT_PASSWORD,
        role: data.role,
        categoryPermissions: data.categoryPermissions
    })
    data.user = user._id;
    user && await adminModel.create(data);
    return user;
}


const deleteAdminService = async (id) => {
    const user = await userDeleteByIdService(id);
    user && await adminModel.findOneAndDelete({ user: id });
    return user;
}



const editAdminService = async (id, data) => {
    const admin = await adminModel.findById(id);
    if (!admin) {
        throw new ApiError(404, 'Admin not found');
    }

    if (data.categoryPermissions) {
        // Replace existing permissions with the new array
        admin.categoryPermissions = data.categoryPermissions;
    }
    await admin.save();
    return admin;
};




const allAdminService = async (options) => {
    const { page = 1, limit = 10 } = options;
    const [result, totalResults] = await Promise.all([
        adminModel.aggregate([
            // { $match: { role : 'admin', categoryPermissions: ['administration'] } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    fullName: '$userInfo.fullName',
                    image: '$userInfo.image',
                    email: '$userInfo.email',
                    active: { $not: ['$userInfo.isBan'] },
                    categoryPermissions: 1,
                    userId: '$userInfo._id'
                }
            }
        ]),
        adminModel.countDocuments({ adminRole: { $ne: 'owner' } })
    ])

    return {
        result,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
            limit
        }
    }
}


const getAdminByUserId = async (id) => {
    return adminModel.findOne({ user: id })
}

module.exports = {
    addAdminService,
    getAdminByUserId,
    editAdminService,
    deleteAdminService,
    allAdminService
}