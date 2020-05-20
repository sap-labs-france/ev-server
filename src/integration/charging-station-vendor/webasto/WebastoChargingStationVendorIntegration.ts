import { ChargingProfile } from '../../../types/ChargingProfile';
import ChargingStation from '../../../types/ChargingStation';
import ChargingStationVendorIntegration from '../ChargingStationVendorIntegration';

export default class WebastoChargingStationVendorIntegration extends ChargingStationVendorIntegration {
  constructor(chargingStation: ChargingStation) {
    super(chargingStation);
  }

  public getOCPPParamNameForChargingLimitation(): string {
    return 'OperatorCurrentLimit';
  }

  public getOCPPParamValueForChargingLimitation(chargingStation: ChargingStation, limitAmp: number): number {
    let numberOfPhase = 1;
    for (const connector of chargingStation.connectors) {
      if (connector && connector.numberOfConnectedPhase > 0) {
        numberOfPhase = connector.numberOfConnectedPhase;
        break;
      }
    }
    return limitAmp / chargingStation.connectors.length / numberOfPhase;
  }

  public convertToVendorChargingProfile(chargingStation: ChargingStation, chargingProfile: ChargingProfile): ChargingProfile {
    // Get vendor specific charging profile
    const vendorSpecificChargingProfile = JSON.parse(JSON.stringify(chargingProfile));
    // Check connector
    if (chargingStation.connectors && vendorSpecificChargingProfile.profile && vendorSpecificChargingProfile.profile.chargingSchedule) {
      let numberOfPhase = 1;
      // Check the Connector
      for (const connector of chargingStation.connectors) {
        if (connector.numberOfConnectedPhase > 0) {
          numberOfPhase = connector.numberOfConnectedPhase;
        }
      }
      // Divide the power by the number of connectors and number of phases
      for (const schedulePeriod of vendorSpecificChargingProfile.profile.chargingSchedule.chargingSchedulePeriod) {
        schedulePeriod.limit = schedulePeriod.limit / (vendorSpecificChargingProfile.connectorID === 0 ?
          chargingStation.connectors.length : 1) / numberOfPhase;
      }
    }
    return vendorSpecificChargingProfile;
  }
}
