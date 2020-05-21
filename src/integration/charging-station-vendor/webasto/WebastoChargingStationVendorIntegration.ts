import { ChargingProfile, ChargingRateUnitType, ChargingSchedule } from '../../../types/ChargingProfile';
import ChargingStation, { PowerLimitUnits } from '../../../types/ChargingStation';

import ChargingStationVendorIntegration from '../ChargingStationVendorIntegration';
import Utils from '../../../utils/Utils';

export default class WebastoChargingStationVendorIntegration extends ChargingStationVendorIntegration {
  constructor(chargingStation: ChargingStation) {
    super(chargingStation);
  }

  public getOCPPParamNameForChargingLimitation(): string {
    return 'OperatorCurrentLimit';
  }

  public getOCPPParamValueForChargingLimitation(chargingStation: ChargingStation, limitAmp: number): number {
    return limitAmp / chargingStation.connectors.length / Utils.getNumberOfConnectedPhases(chargingStation);
  }

  public convertToVendorChargingProfile(chargingStation: ChargingStation, chargingProfile: ChargingProfile): ChargingProfile {
    // Get vendor specific charging profile
    const vendorSpecificChargingProfile = JSON.parse(JSON.stringify(chargingProfile));
    // Check connector
    if (chargingStation.connectors && vendorSpecificChargingProfile.profile && vendorSpecificChargingProfile.profile.chargingSchedule) {
      // Convert to Watts?
      if (chargingStation.powerLimitUnit === PowerLimitUnits.WATT) {
        chargingProfile.profile.chargingSchedule.chargingRateUnit = ChargingRateUnitType.WATT;
      }
      // Divide the power by the number of connectors and number of phases
      for (const schedulePeriod of vendorSpecificChargingProfile.profile.chargingSchedule.chargingSchedulePeriod) {
        schedulePeriod.limit = schedulePeriod.limit / (vendorSpecificChargingProfile.connectorID === 0 ?
          chargingStation.connectors.length : 1) / Utils.getNumberOfConnectedPhases(chargingStation, chargingProfile.connectorID);
        // Check Unit
        if (chargingStation.powerLimitUnit === PowerLimitUnits.WATT) {
          schedulePeriod.limit = Utils.convertAmpToWatt(chargingStation, chargingProfile.connectorID, schedulePeriod.limit);
        }
      }
    }
    return vendorSpecificChargingProfile;
  }

  public convertFromVendorChargingSchedule(chargingStation: ChargingStation, connectorID: number, chargingSchedule: ChargingSchedule): ChargingSchedule {
    // Get vendor specific charging profile
    if (!chargingSchedule) {
      return chargingSchedule;
    }
    if (chargingSchedule.chargingSchedulePeriod) {
      for (const chargingSchedulePeriod of chargingSchedule.chargingSchedulePeriod) {
        // Convert to Amps?
        if (chargingSchedule.chargingRateUnit === ChargingRateUnitType.WATT) {
          chargingSchedulePeriod.limit = Utils.convertWattToAmp(chargingStation, connectorID, chargingSchedulePeriod.limit);
        }
        // Limit is per connector and per phase Convert to max Amp
        chargingSchedulePeriod.limit = chargingSchedulePeriod.limit * (connectorID === 0 ?
          chargingStation.connectors.length : 1) * Utils.getNumberOfConnectedPhases(chargingStation, connectorID);
      }
    }
    // Convert to Amps?
    if (chargingSchedule.chargingRateUnit === ChargingRateUnitType.WATT) {
      chargingSchedule.chargingRateUnit = ChargingRateUnitType.AMPERE;
    }
    return chargingSchedule;
  }
}
