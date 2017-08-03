const mongoose = require('mongoose');

const Address = new mongoose.Schema({
  address1: String,
  address2: String,
  addressPostalCode: String,
  addressLocality: String,
  addressRegion: String,
  addressCountry: String
});

module.exports = mongoose.model('User',{
  name: String,
  firstName: String,
  image: String,
  email: String,
  password: String,
  role: String,
  phone: String,
  mobile: String,
  iNumber: String,
  costCenter: String,
  status: String,
  addresses: [],
  locale: String,
  createdBy: String,
  createdOn: Date,
  lastChangedBy: String,
  lastChangedOn: Date
});
