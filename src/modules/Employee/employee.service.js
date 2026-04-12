const ApiError = require("../../helpers/ApiError");
const { updateUserById } = require("../Auth/auth.service");
const employerModel = require("../Employer/employer.model");
const userModel = require("../User/user.model");
const employeeModel = require("./employee.model");
const mongoose = require("mongoose");

const addEmployeeService = async (data) => {
    // console.log({data});
if(data.phone) {
    const existingUser = await userModel.findOne({ phoneNumber: data.phone });
    if (existingUser) {
        throw new ApiError(400, 'This number already used!');
    }
}
  const session = await mongoose.startSession();
  session.startTransaction();
  try {

    const user = await userModel.create([{
      fullName: data.name,
      phoneNumber: data.phone,
      password: process.env.DEFAULT_PASSWORD,
    }], { session });

    data.user = user[0]._id;

    const employee = await employeeModel.create([data], { session });
    const employer = await employerModel.findOne({ user: data.company });
    // console.log({ employer });
    employer.employeeCount = employer.employeeCount + 1;
    employer.activeEmployeeCount = employer.activeEmployeeCount + 1;
    await employer.save({ session });

    await session.commitTransaction();

    return employee[0];

  } catch (err) {
    await session.abortTransaction();
    throw err;
  }
};


const getEmployeeService = async (id) => {
    return await employeeModel.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(String(id)) } },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user"
            }
        },
        {
            $unwind: {
                path: "$user",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup:{
                from : 'employers',
                localField: 'company',
                foreignField: '_id',
                as: 'emplyerData'
            }
        },
        {
            $unwind: {
                path: "$emplyerData",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                name: 1,
                phone: 1,
                createdAt: 1,
                userType: "$user.role",
                isBan: "$user.isBan",
                wallet: "$user.wallet",
                rating : "$user.rating",
                bookingCompleted: "$user.bookingCompleted",
                reportCount: "$user.reportCount",
                flagCount: "$user.flagCount",
                note : "$user.note",
                employer: "$emplyerData.companyName"
            }
        }
    ])
}


const getAllEmployeeService = async (option) => {
    const {
        page = 1,
        limit = 10,
        search,
        department,
        branch,
        status
    } = option;

    const skip = (page - 1) * limit;

    // dynamic match object
    const matchStage = {};

    if (status) {
        matchStage.status = status;
    }

    if (department) {
        matchStage.department = new mongoose.Types.ObjectId(String(department));
    }

    if (branch) {
        matchStage.branch = new mongoose.Types.ObjectId(String(branch));
    }

    const result = await employeeModel.aggregate([

        { $match: matchStage },

        { $sort: { createdAt: -1 } },

        // USER JOIN
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user"
            }
        },
        {
            $unwind: {
                path: "$user",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from : 'employers',
                localField: 'company',
                foreignField: '_id',
                as: 'emplyerData'
            }
        },
        {
            $unwind: {
                path: "$emplyerData",
                preserveNullAndEmptyArrays: true
            }
        },
        // DEPARTMENT JOIN
        {
            $lookup: {
                from: "departments",
                localField: "department",
                foreignField: "_id",
                as: "department"
            }
        },

        {
            $unwind: {
                path: "$department",
                preserveNullAndEmptyArrays: true
            }
        },

        // BRANCH JOIN
        {
            $lookup: {
                from: "branches",
                localField: "branch",
                foreignField: "_id",
                as: "branch"
            }
        },
        {
            $unwind: {
                path: "$branch",
                preserveNullAndEmptyArrays: true
            }
        },
        ...(search ? [{
            $match: {
                "user.fullName": { $regex: search, $options: "i" }
            }
        }] : []),

        {
            $facet: {

                employee: [
                    { $skip: skip },
                    { $limit: limit },

                    {
                        $project: {
                            employeeId: "$_id",
                            employeeName: "$user.fullName",
                            wallet : "$user.wallet",
                            usages: "$user.usages",
                            phoneNumber: "$user.phoneNumber",
                            departmentName: "$department.name",
                            branchname: "$branch.name",
                            totalUseage: "$usages",
                            status: 1,
                            companyName : "$emplyerData.companyName",
                            isBan: "$user.isBan",
                            createdAt: 1
                        }
                    }
                ],

                totalCount: [
                    { $count: "count" }
                ]
            }
        }
    ]);

    const employee = result[0].employee;
    const totalResults = result[0].totalCount[0]?.count || 0;

    return {
        employee,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
            limit
        }
    };
};


const getCompanyAllEmployeeService = async (user, option) => {
    const {
        page = 1,
        limit = 10,
        search,
        department,
        branch,
        status
    } = option;

    const skip = (page - 1) * limit;

    // dynamic match object
    const matchStage = {company : new mongoose.Types.ObjectId(String(user))};

    if (status) {
        matchStage.status = status;
    }

    if (department) {
        matchStage.department = new mongoose.Types.ObjectId(String(department));
    }

    if (branch) {
        matchStage.branch = new mongoose.Types.ObjectId(String(branch));
    }

    const result = await employeeModel.aggregate([

        { $match: matchStage },

        { $sort: { createdAt: -1 } },

        // USER JOIN
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user"
            }
        },
        {
            $unwind: {
                path: "$user",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from : 'employers',
                localField: 'company',
                foreignField: '_id',
                as: 'emplyerData'
            }
        },
        {
            $unwind: {
                path: "$emplyerData",
                preserveNullAndEmptyArrays: true
            }
        },
        // DEPARTMENT JOIN
        {
            $lookup: {
                from: "departments",
                localField: "department",
                foreignField: "_id",
                as: "department"
            }
        },

        {
            $unwind: {
                path: "$department",
                preserveNullAndEmptyArrays: true
            }
        },

        // BRANCH JOIN
        {
            $lookup: {
                from: "branches",
                localField: "branch",
                foreignField: "_id",
                as: "branch"
            }
        },
        {
            $unwind: {
                path: "$branch",
                preserveNullAndEmptyArrays: true
            }
        },
        ...(search ? [{
            $match: {
                "user.fullName": { $regex: search, $options: "i" }
            }
        }] : []),

        {
            $facet: {

                employee: [
                    { $skip: skip },
                    { $limit: limit },

                    {
                        $project: {
                            employeeId: "$_id",
                            employeeName: "$user.fullName",
                            wallet : "$user.wallet",
                            usages: "$user.usages",
                            phoneNumber: "$user.phoneNumber",
                            departmentName: "$department.name",
                            branchname: "$branch.name",
                            totalUseage: "$usages",
                            status: 1,
                            companyName : "$emplyerData.companyName",
                            isBan: "$user.isBan",
                            createdAt: 1
                        }
                    }
                ],

                totalCount: [
                    { $count: "count" }
                ]
            }
        }
    ]);

    const employee = result[0].employee;
    const totalResults = result[0].totalCount[0]?.count || 0;

    return {
        employee,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
            limit
        }
    };
};


const suspendEmployeeService = async (id) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await employeeModel.findByIdAndUpdate(id, { status: "suspended" }, { new: true }, { session });
        console.log({result});
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



const activeEmployeeService = async (id) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await employeeModel.findByIdAndUpdate(id, { status: "active" }, { new: true }, { session });
        console.log({result});
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


const editEmployeeService = async (id, data) => {
    return await employeeModel.findByIdAndUpdate(id, data, { new: true });
}


const deleteEmployeeService = async (id) => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const employee = await employeeModel.findByIdAndDelete(id, { session });
            const employer = await employerModel.findById(employee.company).session(session);
            if (employer) {
                employer.employeeCount = Math.max(0, employer.employeeCount - 1);
                await employer.save({ session });
            }
            await session.commitTransaction();
            session.endSession();
            return employee;
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            throw err;
        }
}

module.exports = {
    addEmployeeService,
    getEmployeeService,
    getAllEmployeeService,
    editEmployeeService,
    deleteEmployeeService,
    activeEmployeeService,
    suspendEmployeeService,
    getCompanyAllEmployeeService
}