const mongoose = require('mongoose');

module.exports = mongoose.model('Car', {
	manufacturer: String,
	model: String,
	batteryKW: Number,
	autonomyKmWLTP: Number,
	autonomyKmReal: Number,
	horsePower: Number,
	torqueNm: Number,
	performance0To100kmh: Number,
	weightKg: Number,
	lengthMeter: Number,
	widthMeter: Number,
	heightMeter: Number,
	createdBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	createdOn: Date,
	lastChangedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	lastChangedOn: Date
});
