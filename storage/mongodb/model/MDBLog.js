var mongoose = require('mongoose');

module.exports = mongoose.model('Log',{
  level: String,
  source: String,
  module: String,
  method: String,
  timestamp: Date,
  action: String,
  message: String,
  detailedMessages: [],
  userID: {type: String, ref: 'User'},
  chargeBoxID: {type: String, ref: 'ChargingStation'}
});
