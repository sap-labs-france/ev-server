var mongoose = require('mongoose');

module.exports = mongoose.model('DataTransfer',{
  chargeBoxIdentity: String,
  chargeBoxID: {type: mongoose.Schema.ObjectId, ref: 'ChargingStation'},
  vendorId: String,
  messageId: String,
  timestamp: Date,
  data: String
});
