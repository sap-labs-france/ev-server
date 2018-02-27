const mongoose = require('mongoose');

module.exports = mongoose.model('SiteArea', {
	name: String,
	accessControl: Boolean,
	image: String,
	createdBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	createdOn: Date,
	lastChangedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	lastChangedOn: Date,
	siteID: {type: mongoose.Schema.Types.ObjectId, ref: 'Site'}
});
