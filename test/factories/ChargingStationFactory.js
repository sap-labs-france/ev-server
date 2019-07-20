const Factory = require('rosie').Factory;
const faker = require('faker');

module.exports = Factory.define('chargingStation')
  .attr('chargePointVendor', () => {
    return faker.random.alphaNumeric(15);
  })
  .attr('chargePointModel', () => {
    return faker.random.alphaNumeric(15);
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
