var mongoose = require('mongoose');

module.exports = mongoose.model('Configuration',{
  chargeBoxIdentity: String,
  chargeBoxID: {type: mongoose.Schema.ObjectId, ref: 'ChargingStation'},
  timestamp: Date,
  configuration: []
});
