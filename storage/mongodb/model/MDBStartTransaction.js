var mongoose = require('mongoose');

module.exports = mongoose.model('StartTransaction',{
  chargeBoxIdentity: String,
  chargeBoxID: {type: mongoose.Schema.ObjectId, ref: 'ChargingStation'},
  connectorId: Number,
  transactionId: Number,
  idTag: String,
  userID: {type: mongoose.Schema.ObjectId, ref: 'User'},
  timestamp: Date,
  meterStart: Number
});
