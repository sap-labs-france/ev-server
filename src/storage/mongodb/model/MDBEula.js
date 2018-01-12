const mongoose = require('mongoose');

module.exports = mongoose.model('Eula',{
	timestamp: Date,
	language: String,
	version: Number,
	text: String,
	hash: String
});
