var mongoose = require('mongoose');

module.exports = mongoose.model('StopTransaction',{
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  userID: {type: String, ref: 'User'},
  transactionId: Number,
  idTag: String,
  timestamp: Date,
  meterStop: Number,
  reason : String,
  transactionData: []
});
