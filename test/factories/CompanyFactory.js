const Factory = require('rosie').Factory;
const faker = require('faker');
const address = require('./AddressFactory');

module.exports = Factory.define('company')
  .attr('name',() => faker.company.companyName())
  .attr('address',() => address.build());
