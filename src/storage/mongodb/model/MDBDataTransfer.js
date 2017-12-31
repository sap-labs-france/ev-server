const mongoose = require('mongoose');

module.exports = mongoose.model('DataTransfer',{
	_id: String,
	chargeBoxID: {type: String, ref: 'ChargingStation'},
	timestamp: Date,
	vendorId: String,
	messageId: String,
	data: String
});
