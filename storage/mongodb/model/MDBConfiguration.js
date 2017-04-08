var mongoose = require('mongoose');

const Configuration = new mongoose.Schema({
  key: String,
  value: String,
  readonly: Boolean
});

module.exports = mongoose.model('Configuration',{
  _id: String,
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  timestamp: Date,
  configuration: []
});
