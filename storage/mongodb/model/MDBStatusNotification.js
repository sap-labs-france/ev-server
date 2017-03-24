var mongoose = require('mongoose');

module.exports = mongoose.model('StatusNotification',{
  chargeBoxIdentity: String,
  chargeBoxID: {type: mongoose.Schema.ObjectId, ref: 'ChargingStation'},
  connectorId: Number,
  status: String,
  errorCode: String,
  info: String,
  timestamp: Date,
  vendorId: String,
  vendorErrorCode: String
});
