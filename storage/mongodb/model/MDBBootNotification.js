var mongoose = require('mongoose');

module.exports = mongoose.model('BootNotification',{
  chargeBoxIdentity: String,
  chargeBoxID: {type: mongoose.Schema.ObjectId, ref: 'ChargingStation'},
  chargePointVendor: String,
  chargePointModel: String,
  chargePointSerialNumber: String,
  chargeBoxSerialNumber: String,
  firmwareVersion: String,
  iccid: String,
  imsi: String,
  meterType: String,
  meterSerialNumber: String,
  endpoint: String,
  ocppVersion: String,
  timestamp: Date
});
