const mongoose = require('mongoose');

module.exports = mongoose.model('DiagnosticsStatusNotification',{
	_id: String,
	chargeBoxID: {type: String, ref: 'ChargingStation'},
	timestamp: Date,
	status: String
});
