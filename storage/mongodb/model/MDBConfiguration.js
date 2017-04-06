var mongoose = require('mongoose');

module.exports = mongoose.model('Configuration',{
  chargeBoxIdentity: String,
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  timestamp: Date,
  configuration: []
});
