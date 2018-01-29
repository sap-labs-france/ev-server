const mongoose = require('mongoose');

module.exports = mongoose.model('SiteArea', {
	name: String,
	image: String,
	gps: String,
	createdBy: String,
	createdOn: Date,
	lastChangedBy: String,
	lastChangedOn: Date,
	siteID: {type: mongoose.Schema.Types.ObjectId, ref: 'Site'}
});
