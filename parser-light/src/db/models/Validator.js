const mongoose = require('mongoose');

// Schema
const validatorSchema = mongoose.Schema({
    controlAddress: String,
    stashAddress: String,
    status: String,
    commission: Number,
    stakeTotal: String,
    stakeOwn: String,
    stakeDelta: String,
    nominators: [{
        address: String,
        stake: String
    }],
    events: [{
        event: String,
        eventBlock: Number,
        eventTime: Number
    }],
    info: {
        type: Map,
        of: String
    },
    icon: String,
    blocksMissed: Number,
    blocksSigned: Number,
    points: Number,
    averagePoints: Number,
    pointsDown: Boolean,
    authoredBlocks: Number,
    heartbeats: Boolean,
    nextSessionElected: Boolean,
    downTimeSlashCounter84Eras: Number,
    downTimeSlashCounter: Number,
    doubleSignSlashCounter: Number,
    declaredAtBlock: Number,
    declaredAtTime: Number,
    historicalData: [{
        points: [{
            era: Number,
            points: Number
        }],
        slashes: [{
            era: Number,
            total: String
        }]
    }]
}, { collection: 'validators' })

// Export Model
module.exports = mongoose.model('Validator', validatorSchema);
