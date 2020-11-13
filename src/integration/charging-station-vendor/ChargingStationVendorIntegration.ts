import { ChargingProfile, ChargingProfileKindType, ChargingProfilePurposeType, ChargingRateUnitType, ChargingSchedule, ChargingSchedulePeriod, RecurrencyKindType } from '../../types/ChargingProfile';
import ChargingStation, { ChargePoint, ConnectorCurrentLimit, ConnectorCurrentLimitSource, StaticLimitAmps } from '../../types/ChargingStation';
import { OCPPChangeConfigurationCommandResult, OCPPChargingProfileStatus, OCPPClearChargingProfileCommandResult, OCPPClearChargingProfileStatus, OCPPConfigurationStatus, OCPPGetCompositeScheduleCommandResult, OCPPSetChargingProfileCommandResult } from '../../types/ocpp/OCPPClient';

import BackendError from '../../exception/BackendError';
import ChargingStationClientFactory from '../../client/ocpp/ChargingStationClientFactory';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import { ServerAction } from '../../types/Server';
import Utils from '../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'ChargingStationVendorIntegration';

export default abstract class ChargingStationVendorIntegration {
  protected chargingStation: ChargingStation;

  constructor(chargingStation: ChargingStation) {
    this.chargingStation = chargingStation;
  }

  public hasStaticLimitationSupport(chargingStation: ChargingStation): boolean {
    return chargingStation.capabilities?.supportStaticLimitation;
  }

  public async setStaticPowerLimitation(tenantID: string, chargingStation: ChargingStation,
    chargePoint?: ChargePoint, maxAmps?: number): Promise<OCPPChangeConfigurationCommandResult> {
    const numberOfPhases = Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, 0);
    const numberOfConnectors = chargePoint ? chargePoint.connectorIDs.length : chargingStation.connectors.length;
    if (chargePoint.excludeFromPowerLimitation) {
      Logging.logWarning({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        message: `Charge Point '${chargePoint.chargePointID}' is excluded from power limitation`,
        module: MODULE_NAME, method: 'setStaticPowerLimitation',
        detailedMessages: { chargePoint }
      });
      return { status: OCPPConfigurationStatus.NOT_SUPPORTED };
    }
    if (!chargePoint.ocppParamForPowerLimitation) {
      Logging.logWarning({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        message: `No OCPP Parameter provided in template for Charge Point '${chargePoint.chargePointID}'`,
        module: MODULE_NAME, method: 'setStaticPowerLimitation',
        detailedMessages: { chargePoint }
      });
      return { status: OCPPConfigurationStatus.NOT_SUPPORTED };
    }
    // Check if feature is fully supported
    if (!this.hasStaticLimitationFullSupport(chargingStation, chargePoint)) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        module: MODULE_NAME, method: 'setStaticPowerLimitation',
        message: 'Charging Station capabilities or configuration does not support power limitation'
      });
    }
    if (maxAmps < (StaticLimitAmps.MIN_LIMIT_PER_PHASE * numberOfPhases * numberOfConnectors)) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        module: MODULE_NAME, method: 'setStaticPowerLimitation',
        message: `Cannot set the minimum power limit to ${maxAmps}A, minimum expected ${StaticLimitAmps.MIN_LIMIT_PER_PHASE * numberOfPhases * numberOfConnectors}A`,
      });
    }
    if (Utils.isEmptyArray(chargingStation.connectors)) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        module: MODULE_NAME, method: 'setStaticPowerLimitation',
        message: 'The Charging Station has no connector',
        detailedMessages: { maxAmps }
      });
    }
    // Fixed the max amp per connector
    const ocppLimitAmpValue = this.convertLimitAmpPerPhase(chargingStation, chargePoint, 0, maxAmps);
    let result: OCPPChangeConfigurationCommandResult;
    try {
      Logging.logDebug({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_LIMIT_POWER,
        message: `Set Power limitation via OCPP to ${ocppLimitAmpValue}A`,
        module: MODULE_NAME, method: 'setStaticPowerLimitation',
        detailedMessages: { maxAmps, ocppParam: chargePoint.ocppParamForPowerLimitation, ocppLimitAmpValue: ocppLimitAmpValue }
      });
      // Change the OCPP Parameter
      // FIXME: trigger conditional reset?
      result = await OCPPUtils.requestChangeChargingStationOcppParameter(tenantID, chargingStation, {
        key: chargePoint.ocppParamForPowerLimitation,
        value: ocppLimitAmpValue.toString()
      });
    } catch (error) {
      if (!error.status) {
        throw error;
      }
      result = {
        status: error.status
      };
    }
    // Update the connectors limit
    if (result.status === OCPPConfigurationStatus.ACCEPTED ||
      result.status === OCPPConfigurationStatus.REBOOT_REQUIRED) {
      // Update the charger's connectors
      const limitAmpsPerConnector = this.chargePointToConnectorLimitAmps(chargePoint, maxAmps);
      for (const connector of chargingStation.connectors) {
        connector.amperageLimit = limitAmpsPerConnector;
      }
      // Save it
      await ChargingStationStorage.saveChargingStation(tenantID, chargingStation);
    }
    return result;
  }

  public async checkUpdateOfOCPPParams(tenantID: string, chargingStation: ChargingStation,
    ocppParamName: string, ocppParamValue: string): Promise<void> {
    if (chargingStation.chargePoints) {
      for (const chargePoint of chargingStation.chargePoints) {
        if (ocppParamName === chargePoint.ocppParamForPowerLimitation) {
          // Update the connector limit amps
          for (const connectorID of chargePoint.connectorIDs) {
            const connector = Utils.getConnectorFromID(chargingStation, connectorID);
            if (connector) {
              connector.amperageLimit = this.convertLimitAmpToAllPhases(
                chargingStation, chargePoint, connectorID, Utils.convertToInt(ocppParamValue));
              Logging.logInfo({
                tenantID: tenantID,
                source: chargingStation.id,
                action: ServerAction.OCPP_PARAM_UPDATE,
                message: `Connector ID '${connectorID}' amperage limit set to ${connector.amperageLimit}A following an update of OCPP Parameter '${ocppParamName}'`,
                module: MODULE_NAME, method: 'checkUpdateOfOCPPParams',
                detailedMessages: {
                  ocppParamName, ocppParamValue, connectorID,
                  amperageLimit: connector.amperageLimit, chargePoint
                }
              });
            }
          }
          // Save it
          await ChargingStationStorage.saveChargingStation(tenantID, chargingStation);
        }
      }
    }
  }

  public async setChargingProfile(tenantID: string, chargingStation: ChargingStation, chargePoint: ChargePoint,
    chargingProfile: ChargingProfile): Promise<OCPPSetChargingProfileCommandResult | OCPPSetChargingProfileCommandResult[]> {
    // Check if feature is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportChargingProfiles) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'setChargingProfile',
        message: 'Charging Station does not support charging profiles'
      });
    }
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'setChargingProfile',
        message: 'Charging Station is not connected to the backend',
      });
    }
    // Convert to vendor specific profile
    const vendorSpecificChargingProfile = this.convertToVendorChargingProfile(
      chargingStation, chargePoint, chargingProfile);
    try {
      // Check if we have to load all connectors in case connector 0 fails
      if (chargingProfile.connectorID === 0) {
        // Set the Profile
        const result = await chargingStationClient.setChargingProfile({
          connectorId: vendorSpecificChargingProfile.connectorID,
          csChargingProfiles: vendorSpecificChargingProfile.profile
        });
        // Call each connector?
        if (result.status !== OCPPChargingProfileStatus.ACCEPTED) {
          Logging.logWarning({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.CHARGING_PROFILE_UPDATE,
            message: 'Set Charging Profile on Connector ID 0 has been rejected, will try connector per connector',
            module: MODULE_NAME, method: 'clearChargingProfile',
            detailedMessages: { result }
          });
          const results = [] as OCPPSetChargingProfileCommandResult[];
          for (const connector of chargingStation.connectors) {
            const ret = await chargingStationClient.setChargingProfile({
              connectorId: connector.connectorId,
              csChargingProfiles: vendorSpecificChargingProfile.profile
            });
            results.push(ret);
          }
          return results;
        }
        return result;
      }
      // Connector ID > 0
      const result = await chargingStationClient.setChargingProfile({
        connectorId: vendorSpecificChargingProfile.connectorID,
        csChargingProfiles: vendorSpecificChargingProfile.profile
      });
      return result;
    } catch (error) {
      Logging.logError({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        message: 'Error occurred while setting the Charging Profile',
        module: MODULE_NAME, method: 'setChargingProfile',
        detailedMessages: { error: error.message, stack: error.stack }
      });
      if (!error.status) {
        throw error;
      }
      return {
        status: error.status
      };
    }
  }

  public async clearChargingProfile(tenantID: string, chargingStation: ChargingStation,
    chargingProfile: ChargingProfile): Promise<OCPPClearChargingProfileCommandResult | OCPPClearChargingProfileCommandResult[]> {
    // Check if feature is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportChargingProfiles) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_DELETE,
        module: MODULE_NAME, method: 'clearChargingProfile',
        message: 'Charging Station does not support charging profiles'
      });
    }
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_DELETE,
        module: MODULE_NAME, method: 'clearChargingProfile',
        message: 'Charging Station is not connected to the backend',
      });
    }
    try {
      // Check if we have to load all connectors in case connector 0 fails
      if (chargingProfile.connectorID === 0) {
        // Clear the Profile
        const result = await chargingStationClient.clearChargingProfile({
          connectorId: chargingProfile.connectorID
        });
        // Call each connector?
        if (result.status !== OCPPClearChargingProfileStatus.ACCEPTED) {
          Logging.logWarning({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.CHARGING_PROFILE_DELETE,
            module: MODULE_NAME, method: 'clearChargingProfile',
            message: 'Clear Charging Profile on Connector ID 0 has been rejected, will try connector per connector',
            detailedMessages: { result }
          });
          const results = [] as OCPPClearChargingProfileCommandResult[];
          for (const connector of chargingStation.connectors) {
            // Clear the Profile
            const ret = await chargingStationClient.clearChargingProfile({
              connectorId: connector.connectorId
            });
            results.push(ret);
          }
          // Reapply the current limitation
          for (const chargePoint of chargingStation.chargePoints) {
            await this.setStaticPowerLimitation(tenantID, chargingStation, chargePoint,
              Utils.getChargingStationAmperageLimit(chargingStation, chargePoint));
          }
          return results;
        }
        // Reapply the current limitation
        if (result.status === OCPPClearChargingProfileStatus.ACCEPTED) {
          for (const chargePoint of chargingStation.chargePoints) {
            await this.setStaticPowerLimitation(tenantID, chargingStation, chargePoint,
              Utils.getChargingStationAmperageLimit(chargingStation, chargePoint));
          }
        }
        return result;
      }
      // Connector ID > 0
      // Clear the Profile
      const result = await chargingStationClient.clearChargingProfile({
        connectorId: chargingProfile.connectorID
      });
      // Reapply the current limitation
      if (result.status === OCPPClearChargingProfileStatus.ACCEPTED) {
        for (const chargePoint of chargingStation.chargePoints) {
          await this.setStaticPowerLimitation(tenantID, chargingStation, chargePoint,
            Utils.getChargingStationAmperageLimit(chargingStation, chargePoint));
        }
      }
      return result;
    } catch (error) {
      Logging.logError({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_PROFILE_DELETE,
        message: 'Error occurred while clearing the Charging Profile',
        module: MODULE_NAME, method: 'clearChargingProfile',
        detailedMessages: { error: error.message, stack: error.stack }
      });
      throw error;
    }
  }

  public async getCompositeSchedule(tenantID: string, chargingStation: ChargingStation, chargePoint: ChargePoint,
    connectorID: number, durationSecs: number): Promise<OCPPGetCompositeScheduleCommandResult> {
    // Check if feature is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportChargingProfiles) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_GET_COMPOSITE_SCHEDULE,
        module: MODULE_NAME, method: 'getCompositeSchedule',
        message: 'Charging Station does not support charging profiles'
      });
    }
    if (connectorID === 0) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.GET_CONNECTOR_CURRENT_LIMIT,
        module: MODULE_NAME, method: 'getCompositeSchedule',
        message: `Cannot get the charging profiles on Connector ID '${connectorID}'`,
      });
    }
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_GET_COMPOSITE_SCHEDULE,
        module: MODULE_NAME, method: 'getCompositeSchedule',
        message: 'Charging Station is not connected to the backend',
      });
    }
    try {
      // Get the Composite Schedule
      const result = await chargingStationClient.getCompositeSchedule({
        connectorId: connectorID,
        duration: durationSecs,
        chargingRateUnit: chargingStation.powerLimitUnit
      });
      // Convert
      result.chargingSchedule = this.convertFromVendorChargingSchedule(
        chargingStation, chargePoint, result.connectorId, result.chargingSchedule);
      return result;
    } catch (error) {
      Logging.logError({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.CHARGING_STATION_GET_COMPOSITE_SCHEDULE,
        message: 'Error occurred while getting the Composite Schedule',
        module: MODULE_NAME, method: 'getCompositeSchedule',
        detailedMessages: { error: error.message, stack: error.stack }
      });
      if (!error.status) {
        throw error;
      }
      return {
        status: error.status
      };
    }
  }

  public async getCurrentConnectorLimit(tenantID: string, chargingStation: ChargingStation, chargePoint: ChargePoint, connectorID: number): Promise<ConnectorCurrentLimit> {
    // Default
    const limitDefaultMaxAmps = Utils.getConnectorFromID(chargingStation, connectorID).amperageLimit;
    const limitDefaultMaxPower = Utils.getConnectorFromID(chargingStation, connectorID).power;
    // Should fail safe!
    try {
      if (connectorID === 0) {
        throw new BackendError({
          source: chargingStation.id,
          action: ServerAction.GET_CONNECTOR_CURRENT_LIMIT,
          module: MODULE_NAME, method: 'getCurrentConnectorLimit',
          message: 'Cannot get the current connector limit on Connector ID 0',
        });
      }
      // Check first matching Charging Profile
      if (chargingStation.capabilities && chargingStation.capabilities.supportChargingProfiles) {
        // Get the current Charging Profiles
        const chargingProfiles = (await ChargingStationStorage.getChargingProfiles(tenantID, {
          chargingStationIDs: [chargingStation.id]
        }, Constants.DB_PARAMS_MAX_LIMIT)).result;
        // Check the TX Charging Profiles from the DB
        const txChargingProfiles = chargingProfiles.filter((chargingProfile) =>
          chargingProfile.connectorID === connectorID &&
          chargingProfile.profile.chargingProfilePurpose === ChargingProfilePurposeType.TX_PROFILE
        );
        // Check
        let result = this.getCurrentConnectorLimitFromProfiles(
          tenantID, chargingStation, chargePoint, connectorID, txChargingProfiles);
        if (result) {
          return result;
        }
        // Check the TX Default Charging Profiles from the DB
        let txDefaultChargingProfiles = chargingProfiles.filter((chargingProfile) =>
          chargingProfile.connectorID === 0 &&
          chargingProfile.profile.chargingProfilePurpose === ChargingProfilePurposeType.TX_DEFAULT_PROFILE
        );
        if (txDefaultChargingProfiles.length === 0) {
          txDefaultChargingProfiles = chargingProfiles.filter((chargingProfile) =>
            chargingProfile.connectorID === connectorID &&
            chargingProfile.profile.chargingProfilePurpose === ChargingProfilePurposeType.TX_DEFAULT_PROFILE
          );
        }
        // Check
        result = this.getCurrentConnectorLimitFromProfiles(
          tenantID, chargingStation, chargePoint, connectorID, txDefaultChargingProfiles);
        if (result) {
          return result;
        }
        // Check the Max Charging Profiles from the DB
        const maxChargingProfiles = chargingProfiles.filter((chargingProfile) =>
          chargingProfile.connectorID === connectorID &&
          chargingProfile.profile.chargingProfilePurpose === ChargingProfilePurposeType.CHARGE_POINT_MAX_PROFILE
        );
        // Check
        result = this.getCurrentConnectorLimitFromProfiles(
          tenantID, chargingStation, chargePoint, connectorID, maxChargingProfiles);
        if (result) {
          return result;
        }
      }
      // Check next the power limitation
      if (chargingStation.capabilities && chargingStation.capabilities.supportStaticLimitation) {
        // Read the static limitation from connector
        const connectorLimitAmps = Utils.getChargingStationAmperageLimit(chargingStation, chargePoint, connectorID);
        if (connectorLimitAmps > 0) {
          const result: ConnectorCurrentLimit = {
            limitAmps: connectorLimitAmps,
            limitWatts: Utils.convertAmpToWatt(chargingStation, chargePoint, connectorID, connectorLimitAmps),
            limitSource: ConnectorCurrentLimitSource.STATIC_LIMITATION,
          };
          Logging.logInfo({
            tenantID: tenantID,
            source: chargingStation.id,
            action: ServerAction.GET_CONNECTOR_CURRENT_LIMIT,
            message: `Connector ID '${connectorID}' current limit: ${result.limitAmps} A, ${result.limitWatts} W, source '${Utils.getConnectorLimitSourceString(result.limitSource)}'`,
            module: MODULE_NAME, method: 'getCurrentConnectorLimit',
            detailedMessages: { result }
          });
          return result;
        }
      }
    } catch (error) {
      Logging.logError({
        tenantID: tenantID,
        source: chargingStation.id,
        action: ServerAction.GET_CONNECTOR_CURRENT_LIMIT,
        message: `Cannot retrieve the current limit on Connector ID '${connectorID}'`,
        module: MODULE_NAME, method: 'getCurrentConnectorLimit',
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
    // Default on current connector
    const result: ConnectorCurrentLimit = {
      limitAmps: limitDefaultMaxAmps,
      limitWatts: limitDefaultMaxPower,
      limitSource: ConnectorCurrentLimitSource.CONNECTOR
    };
    Logging.logInfo({
      tenantID: tenantID,
      source: chargingStation.id,
      action: ServerAction.GET_CONNECTOR_CURRENT_LIMIT,
      message: `Connector ID '${connectorID}' current limit: ${result.limitAmps} A, ${result.limitWatts} W, source '${Utils.getConnectorLimitSourceString(result.limitSource)}'`,
      module: MODULE_NAME, method: 'getCurrentConnectorLimit',
      detailedMessages: { result }
    });
    return result;
  }

  public convertToVendorChargingProfile(chargingStation: ChargingStation,
    chargePoint: ChargePoint, chargingProfile: ChargingProfile): ChargingProfile {
    // Get vendor specific charging profile
    const vendorSpecificChargingProfile: ChargingProfile = Utils.cloneObject(chargingProfile);
    // Check connector
    if (chargingStation.connectors && vendorSpecificChargingProfile.profile && vendorSpecificChargingProfile.profile.chargingSchedule) {
      // Convert to Watts?
      if (chargingStation.powerLimitUnit === ChargingRateUnitType.WATT) {
        vendorSpecificChargingProfile.profile.chargingSchedule.chargingRateUnit = ChargingRateUnitType.WATT;
      }
      // Divide the power by the number of connectors and number of phases
      for (const schedulePeriod of vendorSpecificChargingProfile.profile.chargingSchedule.chargingSchedulePeriod) {
        // Limit Amps per phase
        if (chargingStation.powerLimitUnit === ChargingRateUnitType.AMPERE) {
          schedulePeriod.limit = this.convertLimitAmpPerPhase(
            chargingStation, chargePoint,
            vendorSpecificChargingProfile.connectorID, schedulePeriod.limit);
        // Limit Watts for all the phases
        } else {
          schedulePeriod.limit = Utils.convertAmpToWatt(
            chargingStation, chargePoint, vendorSpecificChargingProfile.connectorID,
            this.chargePointToConnectorLimitAmps(chargePoint, schedulePeriod.limit));
        }
      }
    }
    return vendorSpecificChargingProfile;
  }

  public convertFromVendorChargingSchedule(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorID: number, chargingSchedule: ChargingSchedule): ChargingSchedule {
    // Get vendor specific charging profile
    if (!chargingSchedule) {
      return chargingSchedule;
    }
    chargingSchedule['durationMins'] = Math.round(chargingSchedule.duration / 60);
    if (chargingSchedule.chargingSchedulePeriod) {
      for (const chargingSchedulePeriod of chargingSchedule.chargingSchedulePeriod) {
        chargingSchedulePeriod['startPeriodMins'] = Math.round(chargingSchedulePeriod.startPeriod / 60);
        // Watts for all phases
        if (chargingSchedule.chargingRateUnit === ChargingRateUnitType.WATT) {
          chargingSchedulePeriod['limitWatts'] = chargingSchedulePeriod.limit;
          chargingSchedulePeriod.limit = Utils.convertWattToAmp(chargingStation, chargePoint, connectorID, chargingSchedulePeriod.limit);
        }
        // Amps for all phases
        chargingSchedulePeriod.limit = this.convertLimitAmpToAllPhases(
          chargingStation, chargePoint, connectorID, chargingSchedulePeriod.limit);
        chargingSchedulePeriod['limitWatts'] = Utils.convertAmpToWatt(chargingStation, chargePoint, connectorID, chargingSchedulePeriod.limit);
      }
    }
    // Charging Plan are always in Amps
    if (chargingSchedule.chargingRateUnit === ChargingRateUnitType.WATT) {
      chargingSchedule.chargingRateUnit = ChargingRateUnitType.AMPERE;
    }
    return chargingSchedule;
  }

  private hasStaticLimitationFullSupport(chargingStation: ChargingStation, chargePoint?: ChargePoint): boolean {
    if (this.hasStaticLimitationSupport(chargingStation) && !chargePoint?.excludeFromPowerLimitation && chargePoint?.ocppParamForPowerLimitation) {
      return true;
    }
    return false;
  }

  private convertLimitAmpPerPhase(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorID = 0, limitAmpAllPhases: number): number {
    let limitAmpPerPhase = limitAmpAllPhases;
    // Per charge point?
    if (connectorID === 0) {
      // Get Amp per connector
      limitAmpPerPhase = this.chargePointToConnectorLimitAmps(chargePoint, limitAmpPerPhase);
    }
    // Per phase
    limitAmpPerPhase /= Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, connectorID);
    return limitAmpPerPhase;
  }

  private convertLimitAmpToAllPhases(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorID = 0, limitAmpPerPhase: number): number {
    let limitAmpAllPhases = limitAmpPerPhase;
    // Per charge point?
    if (connectorID === 0) {
      // Get Amp per connector
      limitAmpAllPhases = this.connectorToChargePointLimitAmps(chargePoint, limitAmpAllPhases);
    }
    // Per phase
    limitAmpAllPhases *= Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, connectorID);
    return limitAmpAllPhases;
  }

  private chargePointToConnectorLimitAmps(chargePoint: ChargePoint, limitAmp: number): number {
    // Check at charge point level
    if (chargePoint.cannotChargeInParallel || chargePoint.sharePowerToAllConnectors) {
      return limitAmp;
    }
    // Default
    return limitAmp / chargePoint.connectorIDs.length;
  }

  private connectorToChargePointLimitAmps(chargePoint: ChargePoint, limitAmp: number): number {
    // Check at charge point level
    if (chargePoint.cannotChargeInParallel || chargePoint.sharePowerToAllConnectors) {
      return limitAmp;
    }
    // Default
    return limitAmp * chargePoint.connectorIDs.length;
  }

  private getCurrentConnectorLimitFromProfiles(tenantID: string, chargingStation: ChargingStation, chargePoint: ChargePoint,
    connectorID: number, chargingProfiles: ChargingProfile[]): ConnectorCurrentLimit {
    // Profiles should already be sorted by connectorID and Stack Level (highest stack level has prio)
    for (const chargingProfile of chargingProfiles) {
      // Set helpers
      const now = moment();
      const chargingSchedule = chargingProfile.profile.chargingSchedule;
      // Check type (Recurring) and if it is already active
      // Adjust the Daily Recurring Schedule to today
      if (chargingProfile.profile.chargingProfileKind === ChargingProfileKindType.RECURRING &&
        chargingProfile.profile.recurrencyKind === RecurrencyKindType.DAILY &&
        now.isAfter(chargingSchedule.startSchedule)) {
        const currentDate = new Date();
        chargingSchedule.startSchedule = new Date(chargingSchedule.startSchedule);
        chargingSchedule.startSchedule.setFullYear(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        // Check if the start of the schedule is yesterday
        if (moment(chargingSchedule.startSchedule).isAfter(now)) {
          chargingSchedule.startSchedule.setDate(currentDate.getDate() - 1);
        }
      }
      // Check if the Charging Profile is active
      if (moment(chargingSchedule.startSchedule).add(chargingSchedule.duration, 's').isAfter(now)) {
        let lastButOneSchedule: ChargingSchedulePeriod;
        // Search the right Schedule Period
        for (const schedulePeriod of chargingSchedule.chargingSchedulePeriod) {
          // Handling of only one period
          if (chargingSchedule.chargingSchedulePeriod.length === 1 && schedulePeriod.startPeriod === 0) {
            const result: ConnectorCurrentLimit = {
              limitAmps: Utils.convertToInt(schedulePeriod.limit),
              limitWatts: Utils.convertAmpToWatt(chargingStation, chargePoint, connectorID, Utils.convertToInt(schedulePeriod.limit)),
              limitSource: ConnectorCurrentLimitSource.CHARGING_PROFILE,
            };
            Logging.logInfo({
              tenantID: tenantID,
              source: chargingStation.id,
              action: ServerAction.GET_CONNECTOR_CURRENT_LIMIT,
              message: `Connector ID '${connectorID}' current limit: ${result.limitAmps} A, ${result.limitWatts} W, source '${Utils.getConnectorLimitSourceString(result.limitSource)} in DB'`,
              module: MODULE_NAME, method: 'getCurrentConnectorLimit',
              detailedMessages: { result }
            });
            return result;
          }
          // Find the right Schedule Periods
          if (moment(chargingSchedule.startSchedule).add(schedulePeriod.startPeriod, 's').isAfter(now)) {
            // Found the schedule: Last but one is the correct one
            const result: ConnectorCurrentLimit = {
              limitAmps: Utils.convertToInt(lastButOneSchedule.limit),
              limitWatts: Utils.convertAmpToWatt(chargingStation, chargePoint, connectorID, Utils.convertToInt(lastButOneSchedule.limit)),
              limitSource: ConnectorCurrentLimitSource.CHARGING_PROFILE,
            };
            Logging.logInfo({
              tenantID: tenantID,
              source: chargingStation.id,
              action: ServerAction.GET_CONNECTOR_CURRENT_LIMIT,
              message: `Connector ID '${connectorID}' current limit: ${result.limitAmps} A, ${result.limitWatts} W, source '${Utils.getConnectorLimitSourceString(result.limitSource)} in DB'`,
              module: MODULE_NAME, method: 'getCurrentConnectorLimit',
              detailedMessages: { result }
            });
            return result;
          }
          // Keep it
          lastButOneSchedule = schedulePeriod;
          // Handle the last schedule period
          if (schedulePeriod.startPeriod === chargingSchedule.chargingSchedulePeriod[chargingSchedule.chargingSchedulePeriod.length - 1].startPeriod) {
            const result: ConnectorCurrentLimit = {
              limitAmps: Utils.convertToInt(lastButOneSchedule.limit),
              limitWatts: Utils.convertAmpToWatt(chargingStation, chargePoint, connectorID, Utils.convertToInt(lastButOneSchedule.limit)),
              limitSource: ConnectorCurrentLimitSource.CHARGING_PROFILE,
            };
            Logging.logInfo({
              tenantID: tenantID,
              source: chargingStation.id,
              action: ServerAction.GET_CONNECTOR_CURRENT_LIMIT,
              message: `Connector ID '${connectorID}' current limit: ${result.limitAmps} A, ${result.limitWatts} W, source '${Utils.getConnectorLimitSourceString(result.limitSource)} in DB'`,
              module: MODULE_NAME, method: 'getCurrentConnectorLimit',
              detailedMessages: { result }
            });
            return result;
          }
        }
      }
    }
    return null;
  }
}

