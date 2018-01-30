const mongoose = require('mongoose');

module.exports = mongoose.model('SiteArea', {
	name: String,
	image: String,
	gps: String,
	siteID: {type: mongoose.Schema.Types.ObjectId, ref: 'Site'}
});
