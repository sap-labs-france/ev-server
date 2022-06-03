import { Factory } from 'rosie';
import faker from 'faker';

export default Factory.define('chargingStationTemplate')
  .attr('chargePointVendor', () => 'Schneider Electric')
  .attr('chargePointSerialNumber', () => faker.random.alphaNumeric(25))
  .attr('chargeBoxSerialNumber', () => 'EV.2S22P44' + faker.random.alphaNumeric(15).toUpperCase())
  .attr('firmwareVersion', () => '3.2.0.' + faker.datatype.number(9).toString());
