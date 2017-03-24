var mongoose = require('mongoose');

module.exports = mongoose.model('MeterValue',{
  chargeBoxIdentity: String,
  chargeBoxID: {type: mongoose.Schema.ObjectId, ref: 'ChargingStation'},
  connectorId: Number,
  transactionId: Number,
  timestamp: Date,
  values: []
});
