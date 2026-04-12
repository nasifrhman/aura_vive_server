const bankModel = require("./bank.model");

const addbankService = async (data) => {
    return await bankModel.create(data);
}

const getAllbankService = async (options) => {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;
    const result = await bankModel.find().skip(skip).limit(limit);
    const totalResults = await bankModel.countDocuments();
    return { result, pagination: { totalResults, totalPages: Math.ceil(totalResults / limit), currentPage: page, limit } };
}

const getMybankService = async (user) => {
    return await bankModel.findOne({user: user});
}

const deleteBankService = async (id) => {
    return await bankModel.findByIdAndDelete(id);
}

module.exports = {
    addbankService,
    getAllbankService,
    getMybankService,
    deleteBankService
}