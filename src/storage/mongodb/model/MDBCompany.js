const mongoose = require('mongoose');

module.exports = mongoose.model('Company',{
	name: String,
	logo: String,
	createdBy: String,
	createdOn: Date,
	lastChangedBy: String,
	lastChangedOn: Date
});
