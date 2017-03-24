var mongoose = require('mongoose');

module.exports = mongoose.model('Authorize',{
  chargeBoxIdentity: String,
  chargeBoxID: {type: mongoose.Schema.ObjectId, ref: 'ChargingStation'},
  timestamp: Date,
  idTag: String
});
