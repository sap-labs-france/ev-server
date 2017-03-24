var mongoose = require('mongoose');

module.exports = mongoose.model('User',{
  idTag: String,
  timestamp: Date,
  name: String,
  tagID: String,
  brand: String,
  plate: String,
  email: String,
  phone: String,
  mobile: String,
  badge: String,
  iNumber: String,
  contract: String,
  costCenter: Number,
  location: String,
  status: String
});
