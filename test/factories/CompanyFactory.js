const Factory = require('rosie').Factory;
const faker = require('faker');
const address = require('./AddressFactory');

module.exports = Factory.define('company')
  .attr('name',() => {
    return faker.company.companyName();
  })
  .attr('address',() => {
    return address.build();
  });
