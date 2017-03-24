var mongoose = require('mongoose');

module.exports = mongoose.model('DiagnosticsStatusNotification',{
  chargeBoxIdentity: String,
  chargeBoxID: {type: mongoose.Schema.ObjectId, ref: 'ChargingStation'},
  timestamp: Date,
  status: String
});
