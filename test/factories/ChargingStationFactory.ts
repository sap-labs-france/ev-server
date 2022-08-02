import ChargingStation from '../../src/types/ChargingStation';
import { Factory } from 'rosie';
import { faker } from '@faker-js/faker';

const chargingStationThreePhased = Factory.define('chargingStation')
  .attr('chargePointVendor', () => 'Schneider Electric')
  .attr('chargePointModel', () => 'MONOBLOCK')
  .attr('chargePointSerialNumber', () => faker.random.alphaNumeric(25))
  .attr('chargeBoxSerialNumber', () => 'EV.2S22P44' + faker.random.alphaNumeric(15).toUpperCase())
  .attr('firmwareVersion', () => '3.2.0.' + faker.datatype.number(9).toString());

const chargingStationUnknownThreePhased = Factory.define('chargingStation')
  .attr('chargePointVendor', () => 'Unknown')
  .attr('chargePointModel', () => 'Unknown')
  .attr('chargePointSerialNumber', () => faker.random.alphaNumeric(25))
  .attr('chargeBoxSerialNumber', () => faker.random.alphaNumeric(15).toUpperCase())
  .attr('firmwareVersion', () => '1.2.' + faker.datatype.number(9).toString());

const chargingStationSinglePhased = Factory.define('chargingStation')
  .attr('chargePointVendor', () => 'Schneider Electric')
  .attr('chargePointModel', () => 'MONOBLOCK')
  .attr('chargePointSerialNumber', () => faker.random.alphaNumeric(25))
  .attr('chargeBoxSerialNumber', () => 'EV.2S7P44' + faker.random.alphaNumeric(15).toUpperCase())
  .attr('firmwareVersion', () => '3.2.0.' + faker.datatype.number(9).toString());

const chargingStationDC = Factory.define('chargingStation')
  .attr('chargePointVendor', () => 'DELTA')
  .attr('chargePointModel', () => '10616')
  .attr('chargePointSerialNumber', () => faker.random.alphaNumeric(25))
  .attr('chargeBoxSerialNumber', () => '20071984' + faker.random.alphaNumeric(15).toUpperCase())
  .attr('firmwareVersion', () => '3.3.' + faker.datatype.number(9).toString());

export default class ChargingStationFactory {
  static build(attributes?, options?): ChargingStation {
    return chargingStationThreePhased.build(attributes, options);
  }

  static buildChargingStationUnknown(attributes?, options?): ChargingStation {
    return chargingStationUnknownThreePhased.build(attributes, options);
  }

  static buildChargingStationSinglePhased(attributes?, options?): ChargingStation {
    return chargingStationSinglePhased.build(attributes, options);
  }

  static buildChargingStationDC(attributes?, options?): ChargingStation {
    return chargingStationDC.build(attributes, options);
  }
}
