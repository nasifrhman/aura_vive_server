const { default: status } = require("http-status");
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");
const {  editAllocateService, deleteAllocateService, getAllocateByIdService, addAllocatedService, getAllAllocateService, pauseUnpauseAllocateService } = require("./allocate.service");


const addAllocateController = catchAsync(async (req, res) => {
    req.body.user = req.User._id
    const allocate = await addAllocatedService(req.body);
    return res.status(status.CREATED).json(response({ status: 'Success', statusCode: status.CREATED, type: 'allocate', message: 'allocate-added', data: allocate }));
});

const editAllocateController = catchAsync(async (req, res) => {
    const allocate = await editAllocateService(req.params.id, req.body);
    return res.status(status.OK).json(response({ status: 'Success', statusCode: status.OK, type: 'allocate', message: 'allocate-edited', data: allocate }));
});

const deleteAllocateController = catchAsync(async (req, res) => {
    const allocate = await deleteAllocateService(req.params.id);
    return res.status(status.OK).json(response({ status: 'Success', statusCode: status.OK, type: 'allocate', message: 'allocate-deleted', data: allocate }));
});


const pauseUnpauseAllocateController = catchAsync(async (req, res) => {
    const allocate = await pauseUnpauseAllocateService(req.params.id);
    return res.status(status.OK).json(response({ status: 'Success', statusCode: status.OK, type: 'allocate', message: 'allocate-paused', data: allocate }));
})


const getAllAllocateController = catchAsync(async (req, res) => {
    const options = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
    };

    const filters = {};

    if (req.query.search) {
        const searchRegex = { $regex: req.query.search, $options: 'i' };
        filters.$or = [
            { name: searchRegex },
            { allocateTo: searchRegex }
        ];
    }

    const allocate = await getAllAllocateService(options, filters);

    return res.status(status.OK).json(
        response({
            status: 'Success',
            statusCode: status.OK,
            type: 'allocate',
            message: 'allocate-found',
            data: allocate
        })
    );
});

const getAllocateByIdController = catchAsync(async (req, res) => {
    const allocate = await pauseUnpauseAllocateService(req.params.id);
    return res.status(status.OK).json(response({ status: 'Success', statusCode: status.OK, type: 'allocate', message: 'allocate-found', data: allocate }));
});


module.exports = {
    addAllocateController,
    editAllocateController,
    deleteAllocateController,
    getAllAllocateController,
    getAllocateByIdController,
    pauseUnpauseAllocateController
}