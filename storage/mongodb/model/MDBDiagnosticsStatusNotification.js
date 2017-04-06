var mongoose = require('mongoose');

module.exports = mongoose.model('DiagnosticsStatusNotification',{
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  timestamp: Date,
  status: String
});
