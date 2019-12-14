import faker from 'faker';
import { Factory } from 'rosie';

export default Factory.define('chargingStation')
  .attr('chargePointVendor', () => 'Schneider Electric')
  .attr('chargePointModel', () => faker.random.alphaNumeric(15).toUpperCase())
  .attr('chargePointSerialNumber', () => faker.random.alphaNumeric(25))
  .attr('chargeBoxSerialNumber', () => 'EV.2S22P44' + faker.random.alphaNumeric(15).toUpperCase())
  .attr('firmwareVersion', () => faker.random.alphaNumeric(25));
