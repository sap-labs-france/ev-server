const Factory = require('rosie').Factory;
const faker = require('faker');

module.exports = Factory.define('address')
  .attr('chargeBoxIdentity',() =>  faker.random.alphaNumeric(12))
  .attr('chargePointVendor',() =>  faker.company.companyName())
  .attr('chargePointModel',() =>  faker.random.words())
  .attr('chargePointSerialNumber',() =>  faker.random.number(1000))
  .attr('chargeBoxSerialNumber',() =>  faker.random.number(1000))
  .attr('firmwareVersion',() =>  faker.random.number(1000))
  .attr('ocppVersion', '1.5');
