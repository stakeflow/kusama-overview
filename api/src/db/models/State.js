const mongoose = require('mongoose');

// Schema
const stateSchema = mongoose.Schema({
  isSyncing: { type: Boolean },
  block: { type: Number },
  activeEra: { type: Number },
  activeValidators: { type: Number },
  validatorSlots: { type: Number },
  candidates: { type: Number },
  sessionIndex: { type: Number },
}, { collection: 'state' });

// Export Model
module.exports = mongoose.model('State', stateSchema);
