var mongoose = require('mongoose');

// var Connector = new mongoose.Schema({
//   connectorId: Number,
//   currentConsumption: Number,
//   status: String,
//   power: Number
// });

module.exports = mongoose.model('ChargingStation',{
  chargeBoxIdentity: String,
  chargePointVendor: String,
  chargePointModel: String,
  chargePointSerialNumber: String,
  chargeBoxSerialNumber: String,
  firmwareVersion: String,
  iccid: String,
  imsi: String,
  meterType: String,
  meterIntervalSecs: Number,
  meterSerialNumber: String,
  endpoint: String,
  ocppVersion: String,
  lastReboot: Date,
  lastHeartBeat: Date,
  connectors: []
});
