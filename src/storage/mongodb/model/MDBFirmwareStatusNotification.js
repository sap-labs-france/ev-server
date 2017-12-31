const mongoose = require('mongoose');

module.exports = mongoose.model('FirmwareStatusNotification',{
	_id: String,
	chargeBoxID: {type: String, ref: 'ChargingStation'},
	timestamp: Date,
	status: String
});
