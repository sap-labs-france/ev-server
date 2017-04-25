var mongoose = require('mongoose');

const Attribute = new mongoose.Schema({
  context: String,
  format: String,
  measurand: String,
  location: String,
  unit: String
});

module.exports = mongoose.model('MeterValue', {
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  connectorId: Number,
  timestamp: { type: Date, index: true },
  transactionId: Number,
  value: Number,
  attribute: Attribute
});
