const Factory = require('rosie').Factory;
const faker = require('faker');

module.exports = Factory.define('chargingStation')
  .attr('chargePointVendor', () => faker.company.companyName(0))
  .attr('chargePointModel', () => faker.commerce.product())
  .attr('chargePointSerialNumber', () => faker.random.alphaNumeric(25))
  .attr('chargeBoxSerialNumber', () => faker.random.alphaNumeric(25))
  .attr('firmwareVersion', () => faker.random.alphaNumeric(25));
