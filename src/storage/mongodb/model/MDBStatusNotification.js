const mongoose = require('mongoose');

module.exports = mongoose.model('StatusNotification',{
	_id: String,
	chargeBoxID: {type: String, ref: 'ChargingStation'},
	connectorId: Number,
	timestamp: Date,
	status: String,
	errorCode: String,
	info: String,
	vendorId: String,
	vendorErrorCode: String
});
