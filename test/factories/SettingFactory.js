const Factory = require('rosie').Factory;
const faker = require('faker');

module.exports = Factory.define('setting')
  .attr('identifier', () => faker.lorem.word())
  .attr('content', null);