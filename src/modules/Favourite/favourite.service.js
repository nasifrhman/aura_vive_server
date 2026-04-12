const favouriteModel = require("./favourite.model");

const addFavouriteService = async (data) => {
    return await favouriteModel.create(data);
}


const unFavouriteService = async (service, user) => {
    return await favouriteModel.findOneAndDelete({
        service: service,
        user: user
    })
}



module.exports = {
    addFavouriteService,
    unFavouriteService
}