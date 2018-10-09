const Factory = require('rosie').Factory;
const faker = require('faker');
const address = require('./address');

module.exports = Factory.define('company')
  .attr('name',() =>  faker.company.companyName() + '_' + faker.random.alphaNumeric(8).toUpperCase())
  .attr('address',() =>  address.build());