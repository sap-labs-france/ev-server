var mongoose = require('mongoose');

module.exports = mongoose.model('Authorize',{
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  timestamp: Date,
  idTag: String
});
