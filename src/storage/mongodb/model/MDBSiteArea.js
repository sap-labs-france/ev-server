const mongoose = require('mongoose');

module.exports = mongoose.model('SiteArea', {
	name: String,
	image: String,
	siteID: {type: mongoose.Schema.Types.ObjectId, ref: 'Site'}
});
