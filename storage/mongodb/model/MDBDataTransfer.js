var mongoose = require('mongoose');

module.exports = mongoose.model('DataTransfer',{
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  vendorId: String,
  messageId: String,
  timestamp: Date,
  data: String
});
