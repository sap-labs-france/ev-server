import { ChargingStationTemplate } from '../../src/types/ChargingStation';
import { Factory } from 'rosie';

const chargingStationTemplate = Factory.define('chargingStationTemplate')
  .attr('template', {
    chargePointVendor: 'Schneider Electric',
    technical: {
      maximumPower: 44160,
      type: 110,
      powerLimitUnit: 'A',
      connectors: [{
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
        connectorIDs: [1, 2],
      }]
    },
    capabilities: [{
      supportedFirmwareVersions: ['test'],
      supportedOcppVersions: ['test'],
      capabilities: {
        supportStaticLimitation: true,
        supportChargingProfiles: true,
        supportRemoteStartStopTransaction: true,
        supportUnlockConnector: true,
        supportReservation: false,
        supportCreditCard: false,
        supportRFIDCard: false,
      }
    }],
    ocppStandardParameters: [{
      supportedFirmwareVersions: ['test'],
      supportedOcppVersions: ['test'],
      parameters: {
        AllowOfflineTxForUnknownId: true,
        AuthorizationCacheEnabled: true,
        StopTransactionOnInvalidId: true
      }
    }],
    ocppVendorParameters: [{
      supportedFirmwareVersions: ['test'],
      supportedOcppVersions: ['test'],
      parameters: {
        authenticationmanager: true,
        ocppconnecttimeout: true,
        clockaligneddatainterval: true
      }
    }]
  })
  .attr('hash', '2c4510465d76887ba5e1d04a14707e8135ef74d797c6de8dca0e7f2eebd2d28c')
  .attr('hashTechnical', 'd112b385b7a531b1ca7b764b3f19e9c30cfb71a0296c51971a07f569dd5596b4')
  .attr('hashCapabilities', 'b6eb6b8ec90ae246cdfa4b57f1b2b9d744ff5ce86658dea7db4b3a84137340ac')
  .attr('hashOcppStandard', '4956a1e4b71797f2086a156b5254c53c3d761cc6d89cd151289c0405b1444fad')
  .attr('hashOcppVendor', 'deda8999e837b15e29eeee76167eb778d053aadbf5f6d05430b490e1ca3791b1')
export default class ChargingStationTemplateFactory {
  static build(attributes?, options?): ChargingStationTemplate {
    return chargingStationTemplate.build(attributes, options);
  }
}
