var mongoose = require('mongoose');

module.exports = mongoose.model('StopTransaction',{
  _id: String,
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  userID: {type: String, ref: 'User'},
  transactionId: Number,
  timestamp: Date,
  meterStop: Number,
  reason : String,
  transactionData: []
});
