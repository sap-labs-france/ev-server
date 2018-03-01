const mongoose = require('mongoose');

module.exports = mongoose.model('CompanyLogo',{
	_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Company'},
	logo: String
});
