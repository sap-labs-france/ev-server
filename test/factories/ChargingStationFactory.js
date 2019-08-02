const Factory = require('rosie').Factory;
const faker = require('faker');

module.exports = Factory.define('chargingStation')
  .attr('chargePointVendor', () => faker.random.alphaNumeric(15))
  .attr('chargePointModel', () => faker.random.alphaNumeric(15))
  .attr('chargePointSerialNumber', () => faker.random.alphaNumeric(25))
  .attr('chargeBoxSerialNumber', () => faker.random.alphaNumeric(25))
  .attr('firmwareVersion', () => faker.random.alphaNumeric(25));
