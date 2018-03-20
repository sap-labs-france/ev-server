const mongoose = require('mongoose');

const StopTransaction = new mongoose.Schema({
	timestamp: Date,
	tagID: {type: String, ref: 'Tag'},
	userID: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	meterStop: Number,
	reason : String,
	transactionData: [],
	totalConsumption: Number,
	totalInactivitySecs: Number
});

module.exports = mongoose.model('Transaction',{
	_id: Number,
	chargeBoxID: {type: String, ref: 'ChargingStation'},
	tagID: {type: String, ref: 'Tag'},
	userID: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	connectorId: Number,
	timestamp: Date,
	reservationId: Number,
	meterStart: Number,
	stop: StopTransaction
});
