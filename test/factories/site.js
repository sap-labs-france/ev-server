const Factory = require('rosie').Factory;
const faker = require('faker');
const address = require('./address');

module.exports = Factory.define('site')
  .attr('name',() =>  faker.company.companyName() + '_' + faker.random.alphaNumeric(8).toUpperCase())
  .attr('allowAllUsersToStopTransactions', false)
  .attr('companyID', null)
  .attr('address',() =>  address.build());