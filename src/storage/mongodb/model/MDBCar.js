const mongoose = require('mongoose');

module.exports = mongoose.model('Car', {
	manufacturer: String,
	model: String,
	image: String,
	batteryKW: Number,
	autonomyKmNEDC: Number,
	autonomyKmFTP75: Number,
	autonomyKmReal: Number,
	horsePower: Number,
	torqueNm: Number,
	engine: String,
	performance100km: Number,
	weightKg: Number,
	lengthMeter: Number,
	widthMeter: Number,
	heightMeter: Number,
	createdBy: String,
	createdOn: Date,
	lastChangedBy: String,
	lastChangedOn: Date,
	siteID: {type: mongoose.Schema.Types.ObjectId, ref: 'Site'}
});
