const { default: mongoose } = require("mongoose");
const commissionModel = require("../Commission/commission.model");
const categoryModel = require("./category.model");


const addCategoryService = async (data) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const [cat] = await categoryModel.create([data], { session });
        await commissionModel.create(
            [{ category: cat._id, commission: 0 }],
            { session }
        );
        await session.commitTransaction();
        session.endSession();
        return cat;
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
};


const editCategoryService = async (id, data) => {
    return await categoryModel.findByIdAndUpdate(id, data, { new: true });
}

const deleteCategoryService = async (id) => {
    return await categoryModel.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
}


const getAllCategoryService = async (option) => {
    const { page, limit } = option;
    const skip = (page - 1) * limit;
    const result = await categoryModel.find({ isDeleted: false }).skip(skip).limit(limit);
    const totalResults = await categoryModel.countDocuments({ isDeleted: false });
    return { result, pagination: { totalResults, totalPages: Math.ceil(totalResults / limit), currentPage: page, limit } };

}


module.exports = { addCategoryService, editCategoryService, deleteCategoryService, getAllCategoryService }