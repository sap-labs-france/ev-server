const Factory = require('rosie').Factory;
const faker = require('faker');
const address = require('./AddressFactory');

module.exports = Factory.define('site')
  .attr('name',() => {
    return faker.company.companyName() + '_' + faker.random.alphaNumeric(8).toUpperCase();
  })
  .attr('companyID', null)
  .attr('allowAllUsersToStopTransactions', false)
  .attr('address',() => {
    return address.build();
  });
