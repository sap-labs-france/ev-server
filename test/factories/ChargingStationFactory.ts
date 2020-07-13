import { Factory } from 'rosie';
import faker from 'faker';

const chargingStationThreePhased = Factory.define('chargingStation')
  .attr('chargePointVendor', () => 'Schneider Electric')
  .attr('chargePointModel', () => 'MONOBLOCK')
  .attr('chargePointSerialNumber', () => faker.random.alphaNumeric(25))
  .attr('chargeBoxSerialNumber', () => 'EV.2S22P44' + faker.random.alphaNumeric(15).toUpperCase())
  .attr('firmwareVersion', () => faker.random.alphaNumeric(25));

const chargingStationSinglePhased = Factory.define('chargingStation')
  .attr('chargePointVendor', () => 'Schneider Electric')
  .attr('chargePointModel', () => 'MONOBLOCK')
  .attr('chargePointSerialNumber', () => faker.random.alphaNumeric(25))
  .attr('chargeBoxSerialNumber', () => 'EV.2S7P44' + faker.random.alphaNumeric(15).toUpperCase())
  .attr('firmwareVersion', () => faker.random.alphaNumeric(25));

const chargingStationDC = Factory.define('chargingStation')
  .attr('chargePointVendor', () => 'DELTA')
  .attr('chargePointModel', () => '10616')
  .attr('chargePointSerialNumber', () => faker.random.alphaNumeric(25))
  .attr('chargeBoxSerialNumber', () => '20071984' + faker.random.alphaNumeric(15).toUpperCase())
  .attr('firmwareVersion', () => faker.random.alphaNumeric(25));

export default class ChargingStationFactory {
  static build(attributes?, options?) {
    return chargingStationThreePhased.build(attributes, options);
  }

  static buildChargingStationSinglePhased(attributes?, options?) {
    return chargingStationSinglePhased.build(attributes, options);
  }

  static buildChargingStationDC(attributes?, options?) {
    return chargingStationDC.build(attributes, options);
  }
}
