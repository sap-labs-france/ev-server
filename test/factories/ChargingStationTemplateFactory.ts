import ChargingStationTemplate from '../../src/types/ChargingStation';
import { Factory } from 'rosie';
import faker from 'faker';

const chargingStationTemplate = Factory.define('chargingStationTemplate')
  .attr('id', () => 'Schneider~EV2S22P44|EVC2S22P4E4E')
  .attr('chargePointVendor', () => 'Schneider Electric')
  .attr('technical', {
    maximumPower: 44160,
    type: 110,
    powerLimitUnit: 'A',
    connectors : [{
      connectorId: 1,
      type: 'T1',
      power: 22080,
      chargePointID: 1,
    }],
    voltage: 230,
    chargePoints: [{
      chargePointID: 1,
      currentType: 'AC',
      amperage: 192,
      numberOfConnectedPhase: 3,
      cannotChargeInParallel: false,
      sharePowerToAllConnectors: false,
      ocppParamForPowerLimitation: 'maxintensitysocket',
      power: 44160,
      connectorIDs : [1, 2],
    }],
  })
  .attr('capabilities', [{
    supportedFirmwareVersions: [ 'test' ],
    supportedOcppVersions:[ 'test'],
    capabilities: {
      supportStaticLimitation : true,
      supportChargingProfiles : true,
      supportRemoteStartStopTransaction : true,
      supportUnlockConnector : true,
      supportReservation : false,
      supportCreditCard : false,
      supportRFIDCard : false,
    }
  }])
  .attr('ocppStandardParameters', [{
    supportedFirmwareVersions: [ 'test' ],
    supportedOcppVersions:[ 'test'],
    parameters: {
      AllowOfflineTxForUnknownId : true,
      AuthorizationCacheEnabled : true,
      StopTransactionOnInvalidId : true
    }
  }])
  .attr('ocppVendorParameters', [{
    supportedFirmwareVersions: [ 'test' ],
    supportedOcppVersions:[ 'test'],
    parameters: {
      authenticationmanager : true,
      ocppconnecttimeout : true,
      clockaligneddatainterval : true
    }
  }]);
export default class ChargingStationTemplateFactory {
  static build(attributes?, options?): ChargingStationTemplate {
    return chargingStationTemplate.build(attributes, options);
  }
}
