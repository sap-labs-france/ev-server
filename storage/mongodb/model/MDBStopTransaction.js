var mongoose = require('mongoose');

module.exports = mongoose.model('StopTransaction',{
  chargeBoxIdentity: String,
  chargeBoxID: {type: mongoose.Schema.ObjectId, ref: 'ChargingStation'},
  transactionId: Number,
  idTag: String,
  timestamp: Date,
  meterStop: Number,
  reason : String,
  transactionData: []
});
