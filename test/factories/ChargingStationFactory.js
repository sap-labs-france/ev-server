const Factory = require('rosie').Factory;
const faker = require('faker');

module.exports = Factory.define('chargingStation')
  .attr('chargePointVendor', () => {
    return faker.company.companyName(0);
  })
  .attr('chargePointModel', () => {
    return faker.commerce.product();
  })
  .attr('chargePointSerialNumber', () => {
    return faker.random.alphaNumeric(25);
  })
  .attr('chargeBoxSerialNumber', () => {
    return faker.random.alphaNumeric(25);
  })
  .attr('firmwareVersion', () => {
    return faker.random.alphaNumeric(25);
  });
