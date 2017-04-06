var mongoose = require('mongoose');

module.exports = mongoose.model('StatusNotification',{
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  connectorId: Number,
  status: String,
  errorCode: String,
  info: String,
  timestamp: Date,
  vendorId: String,
  vendorErrorCode: String
});
