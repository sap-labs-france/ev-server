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
  userID: {type: mongoose.Schema.ObjectId, ref: 'User'},
  chargeBoxID: {type: mongoose.Schema.ObjectId, ref: 'ChargingStation'}
});
