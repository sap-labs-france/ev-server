var mongoose = require('mongoose');

module.exports = mongoose.model('StopTransaction',{
  _id: String,
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  tagID: {type: String, ref: 'Tag'},
  userID: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  transactionId: Number,
  timestamp: Date,
  meterStop: Number,
  reason : String,
  transactionData: []
});
