const mongoose = require('mongoose');

const Connector = new mongoose.Schema({
	connectorId: Number,
	currentConsumption: Number,
	totalConsumption: Number,
	status: String,
	errorCode: String,
	power: Number
});

module.exports = mongoose.model('ChargingStation',{
	_id: String,
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
	lastReboot: Date,
	lastHeartBeat: Date,
	connectors: []
});
