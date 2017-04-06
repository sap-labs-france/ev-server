var mongoose = require('mongoose');

module.exports = mongoose.model('MeterValue',{
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  connectorId: Number,
  transactionId: Number,
  timestamp: Date,
  values: []
});
