var mongoose = require('mongoose');

module.exports = mongoose.model('Authorize',{
  _id: String,
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  timestamp: Date,
  idTag: String
});
