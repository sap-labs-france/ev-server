var mongoose = require('mongoose');

module.exports = mongoose.model('FirmwareStatusNotification',{
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  timestamp: Date,
  status: String
});
