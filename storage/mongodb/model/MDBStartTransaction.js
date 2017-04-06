var mongoose = require('mongoose');

module.exports = mongoose.model('StartTransaction',{
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  userID: {type: String, ref: 'User'},
  connectorId: Number,
  transactionId: Number,
  idTag: String,
  timestamp: Date,
  meterStart: Number
});
