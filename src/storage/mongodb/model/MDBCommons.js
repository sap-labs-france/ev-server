const mongoose = require('mongoose');

const address = new mongoose.Schema({
	address1: String,
	address2: String,
	postalCode: String,
	city: String,
	department: String,
	region: String,
	country: String,
	latitude: Number,
	longitude: Number,
	placeID: String
});

module.exports = {
	Address: address
}
