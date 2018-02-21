const mongoose = require('mongoose');

module.exports = mongoose.model('SiteArea', {
	name: String,
	accessControl: Boolean,
	image: String,
	siteID: {type: mongoose.Schema.Types.ObjectId, ref: 'Site'}
});
