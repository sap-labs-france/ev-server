const Factory = require('rosie').Factory;
const faker = require('faker');

module.exports = Factory.define('address')
  .attr('chargePointVendor',() =>  faker.company.companyName())
  .attr('chargePointModel',() =>  faker.random.words())
  .attr('chargePointSerialNumber',() =>  faker.random.number(1000).toString())
  .attr('chargeBoxSerialNumber',() =>  faker.random.number(1000).toString())
  .attr('firmwareVersion',() =>  faker.random.number(1000).toString());
