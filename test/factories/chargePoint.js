const Factory = require('rosie').Factory;
const faker = require('faker');

module.exports = Factory.define('address')
  .attr('chargePointVendor',() =>  faker.company.companyName()+ '_' + faker.random.alphaNumeric(8).toUpperCase())
  .attr('chargePointModel',() =>  faker.random.words())
  .attr('chargePointSerialNumber',() =>  faker.random.number(1000))
  .attr('chargeBoxSerialNumber',() =>  faker.random.number(1000))
  .attr('firmwareVersion',() =>  faker.random.number(1000))
  .attr('ocppVersion', '1.5');
