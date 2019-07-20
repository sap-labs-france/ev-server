const Factory = require('rosie').Factory;
const faker = require('faker');

module.exports = Factory.define('ocpiEndpoint')
  .attr('name', () => {
    return faker.name.lastName();
  })
  .attr('baseUrl', () => {
    return faker.internet.url();
  })
  .attr('countryCode', 'FR')
  .attr('partyId','107')
  .attr('localToken',() => {
    return faker.internet.password();
  })
  .attr('token',() => {
    return faker.internet.password();
  });
