const SubSubCategory = require("./subCategory.model");


const addSubCategoryService = async (data) => {
    return await SubSubCategory.create(data);
}

const editSubCategoryService = async (id, data) => {
    return await SubSubCategory.findByIdAndUpdate(id, data, { new: true });
}

const deleteSubCategoryService = async (id) => {
    return await SubSubCategory.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
}


const getAllSubCategoryService = async (category, option) => {
    const { page, limit } = option;
    const skip = (page - 1) * limit;
    const result = await SubSubCategory.find({ category: category, isDeleted: false }).skip(skip).limit(limit);
    const totalResults = await SubSubCategory.countDocuments({ category: category, isDeleted: false });
    return { result, pagination: { totalResults, totalPages: Math.ceil(totalResults / limit), currentPage: page, limit } };

}


module.exports = { addSubCategoryService, editSubCategoryService, deleteSubCategoryService, getAllSubCategoryService }