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
	latitude: Number,
	longitude: Number,
	iccid: String,
	imsi: String,
	meterType: String,
	meterSerialNumber: String,
	endpoint: String,
	ocppVersion: String,
	lastReboot: Date,
	lastHeartBeat: Date,
	deleted: Boolean,
	createdBy: String,
	createdOn: Date,
	lastChangedBy: String,
	lastChangedOn: Date,
	connectors: [Connector],
	siteAreaID: {type: mongoose.Schema.Types.ObjectId, ref: 'SiteArea'}
});
