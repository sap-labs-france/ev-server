const mongoose = require('mongoose');

module.exports = mongoose.model('Pricing',{
  timestamp: Date,
  priceKWH: Number,
  priceUnit: String
});
