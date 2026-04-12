const mongoose = require('mongoose')

const adminSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role : { type: String, enum: ['admin', 'hr', 'partner'] },
    categoryPermissions: {
        type: [String],
        enum: [
            'administration',
            'finance',
            'support',
            'operations'
        ]
    }
},
    { timestamps: true }
)

module.exports = mongoose.model('Admin', adminSchema)