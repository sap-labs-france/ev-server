const Factory = require('rosie').Factory;
const faker = require('faker');

module.exports = Factory.define('address')
  .attr('address1', () => {
    return faker.address.streetAddress();
  })
  .attr('address2', () => {
    return faker.address.secondaryAddress();
  })
  .attr('postalCode', () => {
    return faker.address.zipCode();
  })
  .attr('city', () => {
    return faker.address.city();
  })
  .attr('region', () => {
    return faker.address.state();
  })
  .attr('department', () => {
    return faker.address.county();
  })
  .attr('longitude', () => {
    return parseFloat(faker.address.longitude());
  })
  .attr('latitude', () => {
    return parseFloat(faker.address.latitude());
  })
  .attr('country', () => {
    return faker.address.country();
  });
