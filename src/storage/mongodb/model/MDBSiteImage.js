const mongoose = require('mongoose');

module.exports = mongoose.model('SiteImage',{
	_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Site'},
	image: String
});
