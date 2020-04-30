const mongoose = require('mongoose');

// Schema
const stateSchema = mongoose.Schema({
  block: { type: Number },
  activeEra: { type: Number },
  activeEraStartAt: { type: Number },
  activeValidators: { type: Number },
  validatorSlots: { type: Number },
  candidates: { type: Number },
  sessionIndex: { type: Number },
  sessionsPerEra: { type: Number },
}, { collection: 'state' });

// Export Model
module.exports = mongoose.model('State', stateSchema);
