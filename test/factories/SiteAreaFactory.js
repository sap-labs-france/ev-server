const Factory = require('rosie').Factory;
const faker = require('faker');
const address = require('./AddressFactory');

module.exports = Factory.define('siteArea')
  .attr('name', () => faker.company.companyName())
  .attr('siteID', null)
  .attr('accessControl', true)
  .attr('address',() =>  address.build());