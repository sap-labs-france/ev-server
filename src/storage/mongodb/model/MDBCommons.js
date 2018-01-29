const mongoose = require('mongoose');

const address = new mongoose.Schema({
	address1: String,
	address2: String,
	postalCode: String,
	city: String,
	region: String,
	country: String
});

module.exports = {
	Address: address
}
