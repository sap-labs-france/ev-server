const Factory = require('rosie').Factory;
const faker = require('faker');

module.exports = Factory.define('address')
  .attr('address1', () => faker.address.streetAddress())
  .attr('address2',() =>  faker.address.secondaryAddress())
  .attr('postalCode', () => faker.address.zipCode())
  .attr('city', () => faker.address.city())
  .attr('region', () => faker.address.state())
  .attr('department',() =>  faker.address.county())
  .attr('longitude',() =>  faker.address.longitude())
  .attr('latitude', () => faker.address.latitude())
  .attr('country', () => faker.address.country());
