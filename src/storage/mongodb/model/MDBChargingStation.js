const mongoose = require('mongoose');

const Connector = new mongoose.Schema({
	connectorId: Number,
	currentConsumption: Number,
	totalConsumption: Number,
	status: String,
	errorCode: String,
	power: Number,
	activeTransactionID: Number
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
	chargingStationURL: String,
	ocppVersion: String,
	lastReboot: Date,
	lastHeartBeat: Date,
	deleted: Boolean,
	createdBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	createdOn: Date,
	lastChangedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	lastChangedOn: Date,
	connectors: [Connector],
	siteAreaID: {type: mongoose.Schema.Types.ObjectId, ref: 'SiteArea'}
});
