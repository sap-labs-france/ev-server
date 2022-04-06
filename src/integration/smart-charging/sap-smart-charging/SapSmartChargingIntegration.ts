import { ChargePointStatus, OCPPPhase } from '../../../types/ocpp/OCPPServer';
import { ChargingProfile, ChargingProfileKindType, ChargingProfilePurposeType, ChargingRateUnitType, ChargingSchedule, Profile } from '../../../types/ChargingProfile';
import ChargingStation, { ChargePoint, Connector, CurrentType, StaticLimitAmps, Voltage } from '../../../types/ChargingStation';
import { ConnectorAmps, OptimizerCar, OptimizerCarConnectorAssignment, OptimizerChargingProfilesRequest, OptimizerChargingStationConnectorFuse, OptimizerChargingStationFuse, OptimizerFuse, OptimizerResult } from '../../../types/Optimizer';
import { ServerAction, ServerProtocol } from '../../../types/Server';
import Tenant, { TenantComponents } from '../../../types/Tenant';

import AssetStorage from '../../../storage/mongodb/AssetStorage';
import { AssetType } from '../../../types/Asset';
import AxiosFactory from '../../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import BackendError from '../../../exception/BackendError';
import { Car } from '../../../types/Car';
import CarStorage from '../../../storage/mongodb/CarStorage';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import LoggingHelper from '../../../utils/LoggingHelper';
import { SapSmartChargingSetting } from '../../../types/Setting';
import SiteArea from '../../../types/SiteArea';
import SmartChargingIntegration from '../SmartChargingIntegration';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import Transaction from '../../../types/Transaction';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import Utils from '../../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'SapSmartChargingIntegration';

export default class SapSmartChargingIntegration extends SmartChargingIntegration<SapSmartChargingSetting> {
  private axiosInstance: AxiosInstance;

  public constructor(tenant: Tenant, setting: SapSmartChargingSetting) {
    super(tenant, setting);
    this.axiosInstance = AxiosFactory.getAxiosInstance(this.tenant);
  }

  public async checkConnection(): Promise<void> {
    const siteArea = {
      name: 'Dummy Site Area',
      maximumPower: 10000,
      chargingStations: [],
      numberOfPhases: 3,
      voltage: Voltage.VOLTAGE_230
    } as SiteArea;
    try {
      // Build Optimizer request
      const request = await this.buildOptimizerRequest(siteArea);
      // Call Optimizer
      const optimizerURL = await this.buildOptimizerUrl(siteArea);
      await this.axiosInstance.post(optimizerURL, request, {
        headers: {
          Accept: 'application/json',
        }
      });
    } catch (error) {
      throw new BackendError({
        action: ServerAction.SMART_CHARGING,
        message: `${siteArea.name} > SAP Smart Charging service responded with '${error}'`,
        module: MODULE_NAME, method: 'checkConnection',
        detailedMessages: { error: error.stack }
      });
    }
  }

  public async buildChargingProfiles(siteArea: SiteArea, excludedChargingStations?: string[]): Promise<ChargingProfile[]> {
    // Get the Charging Stations of the site area with status charging and preparing
    const chargingStations = await ChargingStationStorage.getChargingStations(this.tenant,
      { siteAreaIDs: [siteArea.id], withSiteArea: true, connectorStatuses: [ChargePointStatus.CHARGING, ChargePointStatus.SUSPENDED_EVSE] },
      Constants.DB_PARAMS_MAX_LIMIT);
    siteArea.chargingStations = chargingStations.result;
    // TODO: Store the Site Area ID in the DB profiles and use siteAreaIDs param in this DB request.
    // Get all the charging station IDs from the site area
    const chargingStationIDs = [];
    for (const chargingStation of siteArea.chargingStations) {
      chargingStationIDs.push(chargingStation.id);
    }
    // Get all Profiles from the site area
    const currentChargingProfilesResponse = await ChargingStationStorage.getChargingProfiles(
      this.tenant, { chargingStationIDs: chargingStationIDs, profilePurposeType:  ChargingProfilePurposeType.TX_PROFILE }, Constants.DB_PARAMS_MAX_LIMIT);
    const currentChargingProfiles = currentChargingProfilesResponse.result;
    const request = await this.buildOptimizerRequest(siteArea, currentChargingProfiles, excludedChargingStations);
    // Call optimizer
    const url = await this.buildOptimizerUrl(siteArea);
    // Check at least one car
    if (request.state.cars.length === 0) {
      await Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.SMART_CHARGING,
        message: `${siteArea.name} > No car connected so no need to call the SAP Smart Charging service`,
        module: MODULE_NAME, method: 'buildChargingProfiles',
        detailedMessages: { request }
      });
      return;
    }
    await Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.SMART_CHARGING,
      message: `${siteArea.name} > Call the SAP Smart Charging service...`,
      module: MODULE_NAME, method: 'buildChargingProfiles',
      detailedMessages: { url, request }
    });
    // Call Optimizer
    const response = await this.axiosInstance.post(url, request, {
      headers: {
        Accept: 'application/json',
      }
    });
    await Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.SMART_CHARGING,
      message: `${siteArea.name} > SAP Smart Charging service has been called successfully`,
      module: MODULE_NAME, method: 'buildChargingProfiles',
      detailedMessages: { response: response.data }
    });
    // Build charging profiles from result
    const chargingProfiles = await this.buildChargingProfilesFromOptimizerResponse(
      siteArea, response.data);
    await Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.SMART_CHARGING,
      message: `${siteArea.name} > Charging Profiles have been built successfully`,
      module: MODULE_NAME, method: 'buildChargingProfiles',
      detailedMessages: { chargingProfiles }
    });
    await this.checkIfChargingProfileAlreadyApplied(chargingProfiles, currentChargingProfiles, siteArea);
    return chargingProfiles;
  }

  private async buildOptimizerUrl(siteArea: SiteArea): Promise<string> {
    // Build URL
    const url = this.setting.optimizerUrl;
    const user = this.setting.user;
    let password = this.setting.password;
    if (password) {
      password = await Cypher.decrypt(this.tenant, password);
    }
    if (!Constants.REGEX_URL_PATTERN.test(url) || !user || !password) {
      throw new BackendError({
        action: ServerAction.SMART_CHARGING,
        message: `${siteArea.name} > SAP Smart Charging service configuration is incorrect`,
        module: MODULE_NAME, method: 'getChargingProfiles',
      });
    }
    const indexProtocolStringEnd = url.startsWith(ServerProtocol.HTTPS) ? 8 : 7;
    const requestUrl = url.slice(0, indexProtocolStringEnd) + user + ':' + password + '@' + url.slice(indexProtocolStringEnd);
    return requestUrl;
  }

  private async buildOptimizerRequest(siteArea: SiteArea, currentChargingProfiles: ChargingProfile[] = [], excludedChargingStations: string[] = [], retry = false):
  Promise<OptimizerChargingProfilesRequest> {
    // Instantiate initial arrays for request
    const cars: OptimizerCar[] = [];
    const carConnectorAssignments: OptimizerCarConnectorAssignment[] = [];
    // Store original site area in case of failure
    const originalSiteArea = siteArea;
    let chargingStationsInError = false;
    // Create indices to generate IDs in number format
    let fuseID = 0;
    this.checkIfSiteAreaIsValid(siteArea);
    // Adjust site limitation
    const rootFuse = await this.buildRootFuse(siteArea, fuseID, excludedChargingStations);
    // Loop through charging stations to get each connector
    for (const chargingStation of siteArea.chargingStations) {
      // Create helper to build fuse tree
      let sumConnectorAmperagePhase1 = 0;
      let sumConnectorAmperagePhase2 = 0;
      let sumConnectorAmperagePhase3 = 0;
      const chargingStationConnectorsFuse: OptimizerChargingStationConnectorFuse[] = [];
      // Loop through connectors to generate Cars, charging stations and car assignments for request
      for (const connector of chargingStation.connectors) {
        // Get the transaction
        const transaction = await this.getTransactionFromChargingConnector(siteArea, chargingStation, connector);
        if (Utils.isNullOrUndefined(transaction)) {
          chargingStationsInError = true;
          excludedChargingStations.push(chargingStation.id);
          continue;
        }
        // Build connector fuse
        const chargingStationConnectorFuse = this.buildChargingStationConnectorFuse(siteArea, fuseID, chargingStation, connector);
        if (!chargingStationConnectorFuse) {
          continue;
        }
        chargingStationConnectorsFuse.push(chargingStationConnectorFuse);
        // Add connector's power
        sumConnectorAmperagePhase1 += chargingStationConnectorFuse.fusePhase1;
        sumConnectorAmperagePhase2 += chargingStationConnectorFuse.fusePhase2;
        sumConnectorAmperagePhase3 += chargingStationConnectorFuse.fusePhase3;
        // Build car
        let car = {} as OptimizerCar;
        // If Car ID is provided - build custom car
        car = await this.buildCar(fuseID, chargingStation, transaction, currentChargingProfiles);
        cars.push(car);
        // Assign car to the connector
        carConnectorAssignments.push({
          carID: fuseID,
          chargingStationID: fuseID // It's a connector but for the optimizer this is a Charging Station
        });
        fuseID++;
      } // End for of connectors
      // Build Charging Station fuse
      const chargingStationFuse = this.buildChargingStationFuse(
        fuseID, sumConnectorAmperagePhase1, sumConnectorAmperagePhase2, sumConnectorAmperagePhase3,
        chargingStationConnectorsFuse);
      fuseID++;
      // Push to fuse tree, if children are not empty
      if (chargingStationFuse.children.length > 0) {
        rootFuse.children.push(chargingStationFuse);
      }
    } // End for of charging stations
    if (chargingStationsInError && retry === false) {
      const request = await this.buildOptimizerRequest(originalSiteArea, currentChargingProfiles, excludedChargingStations, true);
      return request;
    }
    // Build request
    const request: OptimizerChargingProfilesRequest = {
      event: {
        eventType: 'Reoptimize',
      },
      state: {
        fuseTree: {
          rootFuse: rootFuse,
        },
        cars: cars,
        carAssignments: carConnectorAssignments,
        // Calculate seconds from last quarte hour
        currentTimeSeconds: Utils.createDecimal(moment().diff(moment().startOf('hour'), 'seconds')).div(900).modulo(1).mul(900).toNumber(),
      },
    };
    return request;
  }

  private async getTransactionFromChargingConnector(siteArea: SiteArea, chargingStation: ChargingStation, connector: Connector):Promise<Transaction> {
    // Transaction in progress?
    if (!connector.currentTransactionID) {
      // Should not happen
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: this.tenant.id,
        action: ServerAction.SMART_CHARGING,
        module: MODULE_NAME, method: 'getTransactionFromChargingConnector',
        message: `${siteArea.name} > No active transaction on '${chargingStation.id}' connector ID '${connector.connectorId}' Charging station will be excluded from this smart charging run.`,
        detailedMessages: { connector, chargingStation }
      });
      return null;
    }
    // Get the transaction
    const transaction = await TransactionStorage.getTransaction(this.tenant, connector.currentTransactionID);
    if (!transaction) {
      // Should not happen
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: this.tenant.id,
        action: ServerAction.SMART_CHARGING,
        module: MODULE_NAME, method: 'getTransactionFromChargingConnector',
        message: `${siteArea.name} > Active transaction ID '${connector.currentTransactionID}' on '${chargingStation.id}' connector ID '${connector.connectorId}' not found! Charging station will be excluded from this smart charging run.`,
        detailedMessages: { connector, chargingStation }
      });
      return null;
    }
    return transaction;
  }

  private async buildRootFuse(siteArea: SiteArea, fuseID: number, excludedChargingStations?: string[]): Promise<OptimizerFuse> {
    // Get Asset consumption
    const assetConsumptionInWatts = await this.getAssetConsumptionInWatts(siteArea.id);
    if (siteArea.maximumPower !== siteArea.maximumPower - assetConsumptionInWatts) {
      await Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.SMART_CHARGING,
        message: `${siteArea.name} > limit of ${siteArea.maximumPower} W has been adjusted to ${Math.round(siteArea.maximumPower - assetConsumptionInWatts)} W due Asset Consumption`,
        module: MODULE_NAME, method: 'buildRootFuse',
        detailedMessages: { siteArea }
      });
    }
    // Calculate Site Amps excluding asset consumption
    const siteMaxAmps = Utils.createDecimal(siteArea.maximumPower).minus(assetConsumptionInWatts).div(siteArea.voltage).toNumber();
    const siteMaxAmpsPerPhase = Utils.createDecimal(siteMaxAmps).div(siteArea.numberOfPhases).toNumber();
    const rootFuse: OptimizerFuse = {
      '@type': 'Fuse',
      id: fuseID++,
      fusePhase1: siteMaxAmpsPerPhase,
      fusePhase2: siteArea.numberOfPhases > 1 ? siteMaxAmpsPerPhase : 0,
      fusePhase3: siteArea.numberOfPhases > 1 ? siteMaxAmpsPerPhase : 0,
      phase1Connected: true,
      phase2Connected: siteArea.numberOfPhases > 1,
      phase3Connected: siteArea.numberOfPhases > 1,
      children: [],
    };
    for (let i = siteArea.chargingStations.length - 1; i >= 0; i--) {
      const chargePointIDsAlreadyProcessed = [];
      const chargingStation = siteArea.chargingStations[i];
      // Only connectors which charge are in this list
      for (let j = chargingStation.connectors.length - 1; j >= 0; j--) {
        const connector = chargingStation.connectors[j];
        // If available get charge point of connector
        const chargePoint = connector.chargePointID ? Utils.getChargePointFromID(chargingStation, connector.chargePointID) : null;
        // Check if charging station needs to be excluded and if already processed
        if ((Utils.isNullOrUndefined(chargePoint) || chargePoint?.excludeFromPowerLimitation || chargingStation.excludeFromSmartCharging ||
        !chargingStation.capabilities?.supportChargingProfiles || excludedChargingStations?.includes(chargingStation.id)) &&
        !chargePointIDsAlreadyProcessed.includes(chargePoint?.chargePointID)) {
          // Remove the power of the connector in use
          const connectorAmperage = Utils.getChargingStationAmperage(chargingStation, chargePoint, connector.connectorId);
          // Handle single phased site area
          if (siteArea.numberOfPhases === 1) {
            rootFuse.fusePhase1 -= connectorAmperage;
            // Handle single phased stations on three phased site areas
          } else if (Utils.getNumberOfConnectedPhases(chargingStation) === 1) {
            if (connector.phaseAssignmentToGrid?.csPhaseL1) {
              switch (connector.phaseAssignmentToGrid.csPhaseL1) {
                case OCPPPhase.L1:
                  rootFuse.fusePhase1 -= connectorAmperage;
                  break;
                case OCPPPhase.L2:
                  rootFuse.fusePhase2 -= connectorAmperage;
                  break;
                case OCPPPhase.L3:
                  rootFuse.fusePhase3 -= connectorAmperage;
                  break;
              }
            } else {
              rootFuse.fusePhase1 -= connectorAmperage;
            }
          } else {
            // Handle three phased AC/DC stations on three phased site areas
            let connectorAmperagePerPhase = Utils.createDecimal(connectorAmperage).div(3).toNumber();
            // Take into account efficiency
            if (Utils.getChargingStationCurrentType(chargingStation, null, connector.connectorId) === CurrentType.DC) {
              if (chargePoint?.efficiency > 0) {
                connectorAmperagePerPhase = Utils.createDecimal(connectorAmperagePerPhase).mul(100).div(chargePoint.efficiency).toNumber();
              } else {
                // Use safe value if efficiency is not provided
                connectorAmperagePerPhase = Utils.createDecimal(connectorAmperagePerPhase).mul(100).div(Constants.DC_CHARGING_STATION_DEFAULT_EFFICIENCY_PERCENT).toNumber();
              }
            }
            rootFuse.fusePhase1 -= connectorAmperagePerPhase;
            rootFuse.fusePhase2 -= connectorAmperagePerPhase;
            rootFuse.fusePhase3 -= connectorAmperagePerPhase;
          }
          // Remove the connector
          chargingStation.connectors.splice(j, 1);
          // Do not process the same charge point again if power is shared
          if (chargePoint?.sharePowerToAllConnectors || chargePoint?.cannotChargeInParallel) {
            chargePointIDsAlreadyProcessed.push(chargePoint.chargePointID);
          }
        }
      }
      // Check if there are remaining connectors
      if (chargingStation.connectors.length === 0) {
        // Remove charging station
        siteArea.chargingStations.splice(i, 1);
      }
    }
    // Ensure always positive
    if (rootFuse.fusePhase1 < 0) {
      rootFuse.fusePhase1 = 0;
    }
    if (rootFuse.fusePhase2 < 0) {
      rootFuse.fusePhase2 = 0;
    }
    if (rootFuse.fusePhase3 < 0) {
      rootFuse.fusePhase3 = 0;
    }
    // Found unsupported chargers
    if (siteMaxAmps !== rootFuse.fusePhase1 + rootFuse.fusePhase2 + rootFuse.fusePhase3) {
      await Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.SMART_CHARGING,
        message: `${siteArea.name} > limit of ${siteMaxAmps} Amps has been lowered to ${Math.round(rootFuse.fusePhase1 + rootFuse.fusePhase2 + rootFuse.fusePhase3)} Amps due to unsupported charging stations currently being used`,
        module: MODULE_NAME, method: 'buildRootFuse',
        detailedMessages: { rootFuse }
      });
    }
    return rootFuse;
  }

  private buildSafeCar(fuseID: number, chargingStation: ChargingStation, transaction: Transaction): OptimizerCar {
    const voltage = Utils.getChargingStationVoltage(chargingStation);
    const maxConnectorAmpsPerPhase = Utils.getChargingStationAmperagePerPhase(chargingStation, null, transaction.connectorId);
    // Build a 'Safe' car
    const car: OptimizerCar = {
      canLoadPhase1: 1,
      canLoadPhase2: 1,
      canLoadPhase3: 1,
      id: fuseID,
      timestampArrival: 0, // Timestamp arrival is set to 0 in order to get profiles for the next 24h. The arrival time has no real influence to the algorithm of the optimizer
      // TimestampDeparture is not useful for the time being, because if hard coded it lets the request fail after 17:15, can be taken in again, when the user is able to enter a departure time (with a check if it is after the current time)
      // timestampDeparture: 62100, // Mock timestamp departure (17:15) - recommendation from Oliver
      carType: 'BEV',
      maxCapacity: 100 * 1000 / voltage, // Battery capacity in Amp.h (fixed to 100kW.h)
      minLoadingState: (100 * 1000 / voltage) * 0.5, // Battery level at the end of the charge in Amp.h set at 50% (fixed to 50kW.h)
      startCapacity: transaction.currentTotalConsumptionWh / voltage, // Total consumption in Amp.h
      minCurrent: StaticLimitAmps.MIN_LIMIT_PER_PHASE * 3,
      minCurrentPerPhase: StaticLimitAmps.MIN_LIMIT_PER_PHASE,
      maxCurrent: maxConnectorAmpsPerPhase * 3, // Charge capability in Amps
      maxCurrentPerPhase: maxConnectorAmpsPerPhase, // Charge capability in Amps per phase
      suspendable: true,
      immediateStart: false,
      canUseVariablePower: true,
      name: `${transaction.chargeBoxID}~${transaction.connectorId}`,
    };
    return car;
  }

  private async buildCar(fuseID: number, chargingStation: ChargingStation, transaction: Transaction, currentChargingProfiles: ChargingProfile[]): Promise<OptimizerCar> {
    const voltage = Utils.getChargingStationVoltage(chargingStation);
    const customCar = this.buildSafeCar(fuseID, chargingStation, transaction);
    // Handle provided Car
    if (transaction.carID) {
      const transactionCar: Car = await CarStorage.getCar(this.tenant, transaction.carID);
      // Setting limit from car only for 3 phased stations (AmpPerPhase-capability variates on single phased charging)
      if (Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId) === CurrentType.AC &&
        Utils.getNumberOfConnectedPhases(chargingStation, null, transaction.connectorId) === 3) {
        if (transactionCar?.converter?.amperagePerPhase > 0) {
          customCar.maxCurrentPerPhase = transactionCar.converter.amperagePerPhase; // Charge capability in Amps per phase
          customCar.maxCurrent = transactionCar.converter.amperagePerPhase * 3; // Charge capability in Amps
        }
      } else if (Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId) === CurrentType.DC) {
        if (transactionCar?.carCatalog?.fastChargePowerMax > 0) {
          const maxDCCurrent = Utils.convertWattToAmp(
            chargingStation, null, transaction.connectorId, transactionCar.carCatalog.fastChargePowerMax * 1000); // Charge capability in Amps
          customCar.maxCurrentPerPhase = Utils.roundTo((maxDCCurrent / 3), 3); // Charge capability in Amps per phase
          customCar.maxCurrent = customCar.maxCurrentPerPhase * 3;
        }
      }
      if (transactionCar?.carCatalog?.batteryCapacityFull > 0) {
        customCar.maxCapacity = transactionCar.carCatalog.batteryCapacityFull * 1000 / voltage; // Battery capacity in Amp.h
        customCar.minLoadingState = (transactionCar.carCatalog.batteryCapacityFull * 1000 / voltage) * 0.5; // Battery level at the end of the charge in Amp.h set at 50%
      }
    }
    // Override
    this.overrideCarWithRuntimeData(chargingStation, transaction, customCar, currentChargingProfiles);
    // Check if CS is DC and calculate real consumption at the grid
    if (Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId) === CurrentType.DC) {
      const connector = Utils.getConnectorFromID(chargingStation, transaction.connectorId);
      const chargePoint = Utils.getChargePointFromID(chargingStation, connector?.chargePointID);
      if (chargePoint?.efficiency > 0) {
        customCar.maxCurrentPerPhase /= chargePoint.efficiency / 100;
        customCar.maxCurrent = customCar.maxCurrentPerPhase * 3;
      } else {
        // Use safe value if efficiency is not provided
        customCar.maxCurrentPerPhase /= Constants.DC_CHARGING_STATION_DEFAULT_EFFICIENCY_PERCENT / 100;
        customCar.maxCurrent = customCar.maxCurrentPerPhase * 3;
      }
    }
    return customCar;
  }

  private overrideCarWithRuntimeData(chargingStation: ChargingStation, transaction: Transaction, car: OptimizerCar, currentChargingProfiles: ChargingProfile[]) {
    // Check if meter value already received with phases used (only on AC stations)
    if (transaction.phasesUsed) {
      const numberOfPhasesInProgress = Utils.getNumberOfUsedPhasesInTransactionInProgress(chargingStation, transaction);
      // Check if Phases Valid
      if (numberOfPhasesInProgress !== -1) {
        // Check if sticky limit enabled
        if (this.setting.stickyLimitation) {
          // Check if car wants to increase its consumption --> if yes do not limit according the current consumption
          const carIsIncreasingConsumption = this.checkIfCarIsIncreasingConsumption(
            chargingStation, currentChargingProfiles, transaction, CurrentType.AC, numberOfPhasesInProgress);
          if (!carIsIncreasingConsumption) {
            // Check if Car is consuming energy --> if yes do not limit according the current consumption
            if (transaction.currentInstantAmps > 0) {
              // Setting limit to the current instant amps with buffer (If it goes above the station limit it will be limited by the optimizer fuse tree)
              car.maxCurrentPerPhase = Utils.roundTo((transaction.currentInstantAmps / numberOfPhasesInProgress *
                (1 + (typeof this.setting.limitBufferAC === 'number' ? this.setting.limitBufferAC : 0) / 100)), 3);
            } else {
              // When car is not consuming energy limit is set to min Amps
              car.maxCurrentPerPhase = car.minCurrentPerPhase;
            }
          }
        }
        car.canLoadPhase1 = transaction.phasesUsed.csPhase1 ? 1 : 0;
        car.canLoadPhase2 = transaction.phasesUsed.csPhase2 ? 1 : 0;
        car.canLoadPhase3 = transaction.phasesUsed.csPhase3 ? 1 : 0;
        car.minCurrent = car.minCurrentPerPhase * numberOfPhasesInProgress;
        car.maxCurrent = car.maxCurrentPerPhase * numberOfPhasesInProgress;
      }
      // Check if Charging Station is DC
    } else if (Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId) === CurrentType.DC
      && transaction.currentInstantWattsDC > 0 && this.setting.stickyLimitation) {
      // Check if car wants to increase its consumption
      const carIsIncreasingConsumption = this.checkIfCarIsIncreasingConsumption(chargingStation, currentChargingProfiles, transaction, CurrentType.DC);
      if (!carIsIncreasingConsumption) {
        // Get Amps from current DC consumption (Watt)
        const currentInstantAmps = Utils.convertWattToAmp(chargingStation, null, transaction.connectorId, transaction.currentInstantWattsDC);
        // Setting limit to current consumption with buffer (If it goes above the station limit it will be limited by the optimizer fuse tree)
        car.maxCurrentPerPhase = Utils.roundTo((currentInstantAmps / 3 * (1 + (typeof this.setting.limitBufferDC === 'number' ? this.setting.limitBufferDC : 0) / 100)), 3);
        car.maxCurrent = car.maxCurrentPerPhase * 3;
      }
    }
  }

  private connectorIsCharging(connector: Connector): boolean {
    return connector.status === ChargePointStatus.CHARGING ||
      connector.status === ChargePointStatus.SUSPENDED_EV ||
      connector.status === ChargePointStatus.SUSPENDED_EVSE ||
      connector.status === ChargePointStatus.OCCUPIED;
  }

  private getConnectorNbrOfPhasesAndAmps(siteArea: SiteArea, chargingStation: ChargingStation, connector: Connector): ConnectorAmps {
    const connectorAmps: ConnectorAmps = {
      numberOfConnectedPhase: 0,
      totalAmps: 0
    };
    if (connector.chargePointID) {
      const chargePoint = Utils.getChargePointFromID(chargingStation, connector.chargePointID);
      // Get the usual power
      connectorAmps.numberOfConnectedPhase = Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, connector.connectorId);
      connectorAmps.totalAmps = Utils.getChargingStationAmperage(chargingStation, chargePoint, connector.connectorId);
      // Check if the charging station share the power on all connectors and distribute the power evenly
      // Check also if the charging station can charge in // and all other connectors are free
      if (chargePoint.sharePowerToAllConnectors || chargePoint.cannotChargeInParallel) {
        // Get the number of connector in activity
        let numberOfConnectorsCurrentlyCharging = 0;
        for (const connectorID of chargePoint.connectorIDs) {
          const connectorOfChargePoint = Utils.getConnectorFromID(chargingStation, connectorID);
          // Double Check: Normally only connector charging are in the charging station object
          if (!connectorOfChargePoint) {
            continue;
          }
          if (this.connectorIsCharging(connectorOfChargePoint)) {
            numberOfConnectorsCurrentlyCharging++;
          }
        }
        // Should be at least 1
        if (numberOfConnectorsCurrentlyCharging >= 1) {
          // Already several connectors to share energy with
          if (chargePoint.sharePowerToAllConnectors) {
            connectorAmps.totalAmps /= numberOfConnectorsCurrentlyCharging;
          }
          // Already several connectors charging in //
          if (chargePoint.cannotChargeInParallel && numberOfConnectorsCurrentlyCharging > 1) {
            // Annihilate the power of the connector
            connectorAmps.totalAmps = 0;
          }
        }
      }
    } else {
      connectorAmps.numberOfConnectedPhase = connector.numberOfConnectedPhase;
      connectorAmps.totalAmps = connector.amperage;
    }
    if (!connectorAmps.numberOfConnectedPhase) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.SMART_CHARGING,
        module: MODULE_NAME, method: 'getConnectorNbrOfPhasesAndAmps',
        message: `${siteArea.name} > Cannot get the number of phases of connector ID '${connector.connectorId}'`,
        detailedMessages: { connector, chargingStation }
      });
    }
    if (!connectorAmps.totalAmps) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.SMART_CHARGING,
        module: MODULE_NAME, method: 'getConnectorNbrOfPhasesAndAmps',
        message: `${siteArea.name} > Cannot get the amperage of connector ID '${connector.connectorId}'`,
        detailedMessages: { connector, chargingStation }
      });
    }
    return connectorAmps;
  }

  private buildChargingStationConnectorFuse(siteArea: SiteArea, fuseID: number, chargingStation: ChargingStation, connector: Connector): OptimizerChargingStationConnectorFuse {
    // Get connector's power
    const connectorAmps = this.getConnectorNbrOfPhasesAndAmps(siteArea, chargingStation, connector);
    let connectorAmpsPerPhase = connectorAmps.totalAmps / connectorAmps.numberOfConnectedPhase;
    // Check if CS is DC and calculate real consumption at the grid
    if (Utils.getChargingStationCurrentType(chargingStation, null, connector.connectorId) === CurrentType.DC) {
      const chargePoint = Utils.getChargePointFromID(chargingStation, connector.chargePointID);
      if (chargePoint?.efficiency > 0) {
        connectorAmpsPerPhase /= chargePoint.efficiency / 100;
      } else {
        // Use safe value if efficiency is not provided
        connectorAmpsPerPhase /= Constants.DC_CHARGING_STATION_DEFAULT_EFFICIENCY_PERCENT;
      }
    }
    // Build charging station from connector
    const chargingStationConnectorFuse: OptimizerChargingStationConnectorFuse = {
      '@type': 'ChargingStation', // It's connector but for the optimizer this is a Charging Station
      id: fuseID,
      fusePhase1: connectorAmpsPerPhase,
      fusePhase2: connectorAmps.numberOfConnectedPhase > 1 ? connectorAmpsPerPhase : 0,
      fusePhase3: connectorAmps.numberOfConnectedPhase > 1 ? connectorAmpsPerPhase : 0,
      phase1Connected: true,
      phase2Connected: connectorAmps.numberOfConnectedPhase > 1,
      phase3Connected: connectorAmps.numberOfConnectedPhase > 1,
    };
    return chargingStationConnectorFuse;
  }

  private buildChargingStationFuse(fuseID: number,
      sumConnectorAmperagePhase1: number, sumConnectorAmperagePhase2: number, sumConnectorAmperagePhase3: number,
      chargingStationConnectorsFuse: OptimizerChargingStationConnectorFuse[]): OptimizerChargingStationFuse {
    // Each charging station can have multiple connectors (= charge points)
    // A charging station in the optimizer is modelled as a 'fuse'
    // A charging station's connectors are modelled as its 'children'
    const chargingStationFuse: OptimizerChargingStationFuse = {
      '@type': 'Fuse',
      id: fuseID,
      fusePhase1: sumConnectorAmperagePhase1,
      fusePhase2: sumConnectorAmperagePhase2,
      fusePhase3: sumConnectorAmperagePhase3,
      phase1Connected: true,
      phase2Connected: sumConnectorAmperagePhase2 > 0,
      phase3Connected: sumConnectorAmperagePhase3 > 0,
      children: chargingStationConnectorsFuse,
    };
    return chargingStationFuse;
  }

  private async buildChargingProfilesFromOptimizerResponse(siteArea: SiteArea, optimizerResult: OptimizerResult): Promise<ChargingProfile[]> {
    const chargingProfiles: ChargingProfile[] = [];
    // Get the last full 15 minutes to set begin of charging profile
    const startSchedule = new Date();
    startSchedule.setUTCMilliseconds(0);
    startSchedule.setSeconds(0);
    startSchedule.setMinutes((Math.floor(startSchedule.getMinutes() / 15)) * 15);
    // Loop through result of optimizer to get each schedule for each car (connector)
    for (const car of optimizerResult.cars) {
      let currentTimeSlotMins = 0;
      const chargingSchedule = {} as ChargingSchedule;
      // Get ChargingStation ID and Connector ID from name property
      const chargingStationDetails = car.name.split('~');
      const chargingStationID = chargingStationDetails[0];
      const connectorID = Utils.convertToInt(chargingStationDetails[1]);
      // Get the charging station
      const chargingStation = await ChargingStationStorage.getChargingStation(this.tenant, chargingStationID);
      if (!chargingStation) {
        throw new BackendError({
          chargingStationID: chargingStationID,
          companyID: siteArea.site?.companyID,
          siteID: siteArea.siteID,
          siteAreaID: siteArea.id,
          action: ServerAction.SMART_CHARGING,
          module: MODULE_NAME, method: 'buildChargingProfilesFromOptimizerResponse',
          message: `${siteArea.name} > Charging Station not found`
        });
      }
      const connector = Utils.getConnectorFromID(chargingStation, connectorID);
      let numberOfConnectedPhase = 0;
      let chargePoint: ChargePoint;
      if (connector.chargePointID) {
        chargePoint = Utils.getChargePointFromID(chargingStation, connector.chargePointID);
        numberOfConnectedPhase = Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, connector.connectorId);
      } else {
        numberOfConnectedPhase = connector.numberOfConnectedPhase;
      }
      // Set profile
      chargingSchedule.chargingRateUnit = ChargingRateUnitType.AMPERE;
      chargingSchedule.chargingSchedulePeriod = [];
      chargingSchedule.startSchedule = startSchedule;
      // Get OCPP Parameter for max periods
      const maxScheduleLength = parseInt(await ChargingStationStorage.getOcppParameterValue(this.tenant, chargingStationID, 'ChargingScheduleMaxPeriods'));
      // Start from now up to the third slot
      for (let i = 0; i < (!isNaN(maxScheduleLength) ? maxScheduleLength : 20) &&
      i < car.currentPlan.length && (car.currentPlan[i] > 0 || chargingSchedule.chargingSchedulePeriod.length < 3); i++) {
        chargingSchedule.chargingSchedulePeriod.push({
          startPeriod: currentTimeSlotMins * 15 * 60, // Start period in secs (starts at 0 sec from startSchedule date/time)
          limit: this.calculateCarConsumption(chargingStation, connector, numberOfConnectedPhase, car.currentPlan[i])
        });
        currentTimeSlotMins++;
      }
      // Set total duration in secs
      chargingSchedule.duration = currentTimeSlotMins * 15 * 60;
      // Build profile of charging profile
      const profile: Profile = {
        chargingProfileId: connectorID,
        chargingProfileKind: ChargingProfileKindType.ABSOLUTE,
        chargingProfilePurpose: ChargingProfilePurposeType.TX_PROFILE, // Profile with constraints to be imposed by the Charge Point on the current transaction. A profile with this purpose SHALL cease to be valid when the transaction terminates.
        transactionId: connector.currentTransactionID,
        stackLevel: 2, // Value determining level in hierarchy stack of profiles. Higher values have precedence over lower values. Lowest level is 0.
        chargingSchedule: chargingSchedule
      };
      // Build charging profile with charging station id and connector id
      const chargingProfile: ChargingProfile = {
        chargingStationID: chargingStationID,
        chargingStation: chargingStation,
        connectorID: connectorID,
        chargePointID: chargePoint.chargePointID,
        profile: profile
      };
      // Resolve id for charging station and connector from helper array
      chargingProfiles.push(chargingProfile);
    } // End for of cars
    return chargingProfiles;
  }

  private calculateCarConsumption(chargingStation: ChargingStation, connector: Connector, numberOfConnectedPhase: number, currentLimit: number): number {
    // Calculation of power which the car consumes after the loss of power in the charging station
    if (Utils.getChargingStationCurrentType(chargingStation, null, connector.connectorId) === CurrentType.DC) {
      const chargePoint = Utils.getChargePointFromID(chargingStation, connector.chargePointID);
      if (chargePoint?.efficiency > 0) {
        return Utils.roundTo(currentLimit * chargePoint.efficiency / 100 * numberOfConnectedPhase, 1);
      }
      return Utils.roundTo(currentLimit * Constants.DC_CHARGING_STATION_DEFAULT_EFFICIENCY_PERCENT * numberOfConnectedPhase, 1);
    }
    return Utils.roundTo((currentLimit * numberOfConnectedPhase), 1);
  }

  private checkIfCarIsIncreasingConsumption(chargingStation: ChargingStation, currentChargingProfiles: ChargingProfile[], transaction: Transaction, currentType: CurrentType,
      numberOfPhasesInProgress?: number): boolean {
    // Get the current charging profile for the current car
    const currentProfile = currentChargingProfiles.filter((chargingProfile) =>
      chargingProfile.profile.transactionId === transaction.id &&
      chargingProfile.chargingStationID === transaction.chargeBoxID &&
      chargingProfile.connectorID === transaction.connectorId);
    // Check if only one charging profile is in place
    if (currentProfile.length === 1) {
      const currentLimit = this.getCurrentSapSmartChargingProfileLimit(currentProfile[0]);
      // Check if current limit is 0 or if profile is expired --> if yes the car wants to increase consumption
      if (currentLimit < 1) {
        return true;
      }
      const numberOfPhasesChargingStation = Utils.getNumberOfConnectedPhases(chargingStation, null, transaction.connectorId);
      // Check if buffer is used for AC stations
      if (currentType === CurrentType.AC) {
        const currentLimitPerPhase = currentLimit / numberOfPhasesChargingStation; // 32A
        // Get amps per phase of the car when the optimizer was called the last time
        let threshold = currentLimitPerPhase / (1 + this.setting.limitBufferAC / 100); // pragma limitBufferAC = 20% of 32A => 26A
        // Use difference between threshold and last consumption multiplied by 20% to eliminate small fluctuations of the car in the charge
        const normalFluctuation = (currentLimitPerPhase - threshold) * 0.2; // 32A - 26A = 6A * 0.2 = 1.2A
        // Add the normal fluctuation to the threshold
        threshold = threshold + normalFluctuation; // 26A + 1.2A = 27.2
        // Check if threshold is exceeded
        if (threshold < (transaction.currentInstantAmps / numberOfPhasesInProgress)) {
          // If yes the car increased its consumption
          return true;
        }
      // Check if buffer is used for DC stations
      } else if (currentType === CurrentType.DC) {
        // Get amps of the car when the optimizer was called the last time
        let threshold = currentLimit / (1 + this.setting.limitBufferDC / 100);
        // Use difference between threshold and last consumption multiplied by 20% to eliminate small fluctuations of the car in the charge
        const normalFluctuation = (currentLimit - threshold) * 0.2;
        // Add the normal fluctuation to the threshold
        threshold = threshold + normalFluctuation;
        if (threshold < Utils.convertWattToAmp(chargingStation, null, transaction.connectorId, transaction.currentInstantWattsDC)) {
          // If yes the car increased its consumption
          return true;
        }
      }
    }
    return false;
  }

  private getCurrentSapSmartChargingProfileLimit(currentProfile: ChargingProfile): number {
    // Get the current slot to get the current period of the schedule
    const currentSlot = Math.floor((moment().diff(moment(currentProfile.profile.chargingSchedule.startSchedule), 'minutes')) / 15);
    // Check if charging profile is expired
    if (currentSlot < currentProfile.profile.chargingSchedule.chargingSchedulePeriod.length) {
      // Get current limit and number of phases
      const currentLimit = currentProfile.profile.chargingSchedule.chargingSchedulePeriod[currentSlot]?.limit;
      return currentLimit;
    }
    return -1;
  }

  private async getAssetConsumptionInWatts(siteAreaId: string): Promise<number> {
    const tenant = await TenantStorage.getTenant(this.tenant.id);
    if (Utils.isTenantComponentActive(tenant, TenantComponents.ASSET)) {
      // Create cumulated consumption helper
      let cumulatedConsumptionWatt = 0;
      // Get assets
      const assets = await AssetStorage.getAssets(tenant,
        {
          siteAreaIDs: [siteAreaId],
        },
        Constants.DB_PARAMS_MAX_LIMIT
      );
      for (const asset of assets.result) {
        if (!asset.excludeFromSmartCharging) {
          // Handle dynamic assets
          if (asset.dynamicAsset) {
            // Calculate fluctuation from static value
            const fluctuation = (asset.staticValueWatt * (asset.fluctuationPercent / 100));
            let consumptionSaveValue = 0;
            // Check if current consumption is up to date
            if ((moment().diff(moment(asset.lastConsumption?.timestamp), 'minutes')) < 2) {
              if (asset.currentInstantWatts > 0) {
                // Ensure consumption does not exceed static value
                consumptionSaveValue = ((asset.currentInstantWatts + fluctuation < asset.staticValueWatt) ? (asset.currentInstantWatts + fluctuation) : asset.staticValueWatt);
              } else if (asset.currentInstantWatts < 0) {
                // Ensure production does not exceed 0
                consumptionSaveValue = ((asset.currentInstantWatts + fluctuation < 0) ? (asset.currentInstantWatts + fluctuation) : 0);
              }
            } else if (asset.assetType === AssetType.CONSUMPTION || asset.assetType === AssetType.CONSUMPTION_AND_PRODUCTION) {
              consumptionSaveValue = asset.staticValueWatt;
            }
            cumulatedConsumptionWatt += consumptionSaveValue;
            if (asset.powerWattsLastSmartChargingRun !== asset.currentInstantWatts) {
              asset.powerWattsLastSmartChargingRun = asset.currentInstantWatts;
              await AssetStorage.saveAsset(tenant, asset);
            }
          } else if (asset.assetType === AssetType.CONSUMPTION || asset.assetType === AssetType.CONSUMPTION_AND_PRODUCTION) {
            // If not dynamic add static consumption for consuming assets
            cumulatedConsumptionWatt += asset.staticValueWatt;
          }
        }
      }
      return cumulatedConsumptionWatt;
    }
    return 0;
  }

  private async checkIfChargingProfileAlreadyApplied(chargingProfiles: ChargingProfile[], currentChargingProfiles: ChargingProfile[], siteArea: SiteArea): Promise<void> {
    // Count removed charging profiles
    let removedChargingProfiles = 0;
    // Loop through current charging profiles from data base
    for (let i = 0; i < currentChargingProfiles.length; i++) {
      // Check if profile for the same transaction ID already exists
      const chargingProfileIndex = chargingProfiles.findIndex((cp) => cp.profile.transactionId === currentChargingProfiles[i].profile.transactionId);
      if (chargingProfileIndex >= 0) {
        // Check if profiles are identical
        if (JSON.stringify(chargingProfiles[chargingProfileIndex].profile) === JSON.stringify(currentChargingProfiles[i].profile)) {
          chargingProfiles.splice(chargingProfileIndex, 1);
          removedChargingProfiles++;
        }
      }
    }
    if (removedChargingProfiles > 0) {
      await Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.SMART_CHARGING,
        message: `${siteArea.name} > ${removedChargingProfiles} Charging Profiles have been already applied and will be removed from charging profile schedule`,
        module: MODULE_NAME, method: 'checkIfChargingProfileAlreadyApplied'
      });
    }
  }
}
