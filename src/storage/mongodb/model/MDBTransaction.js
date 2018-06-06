const mongoose = require('mongoose');

const StopTransaction = new mongoose.Schema({
	timestamp: Date,
	tagID: String,
	userID: mongoose.Schema.Types.ObjectId,
	meterStop: Number,
	reason : String,
	transactionData: [],
	totalConsumption: Number,
	totalInactivitySecs: Number
});

const RemoteStopTransaction = new mongoose.Schema({
	timestamp: Date,
	tagID: String
});

module.exports = mongoose.model('Transaction',{
	_id: Number,
	chargeBoxID: String,
	tagID: String,
	userID: mongoose.Schema.Types.ObjectId,
	connectorId: Number,
	timestamp: Date,
	reservationId: Number,
	meterStart: Number,
	stop: StopTransaction,
	remotestop: RemoteStopTransaction
});
