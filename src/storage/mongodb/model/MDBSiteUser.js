const mongoose = require('mongoose');

module.exports = mongoose.model('SiteUser',{
	siteID: {type: mongoose.Schema.Types.ObjectId, ref: 'Site'},
	userID: {type: mongoose.Schema.Types.ObjectId, ref: 'User'}
});
