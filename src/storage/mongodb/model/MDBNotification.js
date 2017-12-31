const mongoose = require('mongoose');

module.exports = mongoose.model('Notification',{
	_id: String,
	timestamp: Date,
	channel: String,
	sourceId: String,
	sourceDescr: String,
	userID: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	chargeBoxID: {type: String, ref: 'ChargingStation'}
});
