var mongoose = require('mongoose');

module.exports = mongoose.model('FirmwareStatusNotification',{
  chargeBoxIdentity: String,
  chargeBoxID: {type: mongoose.Schema.ObjectId, ref: 'ChargingStation'},
  timestamp: Date,
  status: String
});
