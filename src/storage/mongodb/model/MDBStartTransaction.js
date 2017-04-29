var mongoose = require('mongoose');

module.exports = mongoose.model('StartTransaction',{
  _id: String,
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  tagID: {type: String, ref: 'Tag'},
  userID: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  connectorId: Number,
  timestamp: Date,
  reservationId: Number,
  transactionId: Number,
  meterStart: Number
});
