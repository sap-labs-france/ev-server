var mongoose = require('mongoose');

module.exports = mongoose.model('BootNotification',{
  _id: String,
  chargeBoxIdentity: String,
  timestamp: Date,
  chargeBoxID: {type: String, ref: 'ChargingStation'},
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
  ocppVersion: String
});
