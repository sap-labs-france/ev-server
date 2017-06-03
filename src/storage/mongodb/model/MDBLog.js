var mongoose = require('mongoose');

module.exports = mongoose.model('Log',{
  timestamp: { type: Date, index: true },
  level: String,
  source: String,
  module: String,
  method: String,
  action: String,
  message: String,
  detailedMessages: [],
  userID: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  userFullName: String,
  chargeBoxID: {type: String, ref: 'ChargingStation'}
});
