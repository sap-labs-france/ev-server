const mongoose = require('mongoose');

module.exports = mongoose.model('SiteAreaImage',{
	_id: {type: mongoose.Schema.Types.ObjectId, ref: 'SiteArea'},
	image: String
});
