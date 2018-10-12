const Factory = require('rosie').Factory;
const faker = require('faker');

module.exports = Factory.define('site')
  .attr('name',() =>  faker.random.words()+ '_' + faker.random.alphaNumeric(8).toUpperCase());