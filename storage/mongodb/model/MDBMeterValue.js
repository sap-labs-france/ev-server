var mongoose = require('mongoose');

const Attribute = new mongoose.Schema({
  context: String,
  format: String,
  measurand: String,
  location: String,
  unit: String
});

const Value = new mongoose.Schema({
  value: Number,
  attributes: Attribute
});

module.exports = mongoose.model('MeterValue', {
  _id: String,
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  connectorId: Number,
  timestamp: Date,
  transactionId: Number,
  values: []
});
