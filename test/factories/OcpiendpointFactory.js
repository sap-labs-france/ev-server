const Factory = require('rosie').Factory;
const faker = require('faker');

module.exports = Factory.define('ocpiendpoint')
  .attr('name', () => faker.name.lastName())
  .attr('version', null);