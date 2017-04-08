var mongoose = require('mongoose');

module.exports = mongoose.model('StartTransaction',{
  _id: String,
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  connectorId: Number,
  timestamp: Date,
  userID: {type: String, ref: 'User'},
  transactionId: Number,
  meterStart: Number
});
