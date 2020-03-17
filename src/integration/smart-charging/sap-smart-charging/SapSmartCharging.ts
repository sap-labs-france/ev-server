import Axios from 'axios';
import BackendError from '../../../exception/BackendError';
import { Action } from '../../../types/Authorization';
import { ChargingProfile, ChargingProfileKindType, ChargingProfilePurposeType, ChargingRateUnitType, ChargingSchedule, Profile } from '../../../types/ChargingProfile';
import { Connector } from '../../../types/ChargingStation';
import { ChargePointStatus } from '../../../types/ocpp/OCPPServer';
import { OptimizerCar, OptimizerCarAssignment, OptimizerChargingProfilesRequest, OptimizerChargingStation, OptimizerEvent, OptimizerFuse, OptimizerFuseTree, OptimizerState } from '../../../types/Optimizer';
import { SapSmartChargingSetting } from '../../../types/Setting';
import SiteArea from '../../../types/SiteArea';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import SmartCharging from '../SmartCharging';
import moment = require('moment');

export default class SapSmartCharging extends SmartCharging<SapSmartChargingSetting> {

  // Helper to resolve generated IDs, Charging Station IDs and Connector IDs --> Oliver is asked to implement String ID Property
  private idAssignments = [];

  public constructor(tenantID: string, setting: SapSmartChargingSetting) {
    super(tenantID, setting);
  }

  public async getChargingProfiles(siteArea: SiteArea): Promise<ChargingProfile[]> {
    // Optimizer implementation:
    // Get seconds since midnight
    // Moment at midnight
    const mmtMidnight = moment().startOf('day');
    // Difference in seconds
    const currentTimeSeconds = moment().diff(mmtMidnight, 'seconds');
    try {
      // Call Optimizer
      const response = await Axios.post(this.buildUrl(), this.buildRequest(siteArea, currentTimeSeconds), {
        headers: {
          Accept: 'application/json',
        }
      });
      // Build charging profiles from result
      return this.buildChargingProfiles(response.data, (currentTimeSeconds / 60));

    } catch (error) {
      Logging.logError({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Action.CALL_OPTIMIZER,
        module: 'SapSmartCharging',
        method: 'getChargingProfiles',
        message: 'Unable to call Optimizer'
      });
    }
  }

  private buildUrl(): string {
    // Build URL
    const url = this.setting.optimizerUrl;
    const user = this.setting.user;
    const password = Cypher.decrypt(this.setting.password);
    const requestUrl = url.slice(0, 8) + user + ':' + password + '@' + url.slice(8);
    return requestUrl;
  }


  private buildRequest(siteArea: SiteArea, currentTimeSeconds: number): OptimizerChargingProfilesRequest {
    // Instantiate initial arrays for request
    const cars: OptimizerCar[] = [];
    const carAssignments: OptimizerCarAssignment[] = [];
    const chargingStations: OptimizerChargingStation[] = [];
    // Create indices to generate IDs in number format
    let fuseID = 1; // Start at 1 because root fuse will have ID=0
    let connectorIndex = 0; // Connector Index to give IDs of format: number
    if (!siteArea.maximumPower) {
      throw new BackendError({
        action: Action.CALL_OPTIMIZER,
        module: 'SapSmartCharging', method: 'buildRequest',
        message: 'Maximum Power property is not set for Site Area'
      });
    }
    // Create root fuse
    const rootFuse: OptimizerFuse = {
      id: 0,
      fusePhase1: siteArea.maximumPower / (230 * 3),
      fusePhase2: siteArea.maximumPower / (230 * 3),
      fusePhase3: siteArea.maximumPower / (230 * 3),
      children: [],
    };
    // Charging Stations
    if (!siteArea.chargingStations) {
      throw new BackendError({
        action: Action.CALL_OPTIMIZER,
        module: 'SapSmartCharging', method: 'buildRequest',
        message: `No Charging Stations in Site Area '${siteArea.name}'`
      });
    }
    // Loop through charging stations to get each connector
    for (const chargingStation of siteArea.chargingStations) {
      // Create helper to build fuse tree
      let sumConnectorAmperagePhase1 = 0;
      let sumConnectorAmperagePhase2 = 0;
      let sumConnectorAmperagePhase3 = 0;
      const chargingStationChildren = [];
      // Loop through connectors to generate Cars, charging stations and car assignments for request
      for (const connector of chargingStation.connectors) {
        // Check if connector is charging
        if (connector.status === ChargePointStatus.CHARGING ||
            connector.status === ChargePointStatus.SUSPENDED_EV ||
            connector.status === ChargePointStatus.SUSPENDED_EVSE) {
          // Build Car
          cars.push(this.buildCar(connectorIndex));
          // Build Charging Station
          const chargingStation = this.buildChargingStation(connectorIndex, connector);
          chargingStations.push(chargingStation);
          chargingStationChildren.push(chargingStation);
          // Assign Car to Charging Station
          carAssignments.push(this.buildCarAssignment(connectorIndex));
          // Calculate
          sumConnectorAmperagePhase1 += chargingStation.fusePhase1;
          sumConnectorAmperagePhase2 += chargingStation.fusePhase2;
          sumConnectorAmperagePhase3 += chargingStation.fusePhase3;
          // Build helper to know, which charging station has which generated id
          const idAssignment = {
            generatedId: connectorIndex,
            chargingStationId: chargingStation.id,
            connectorId: connector.connectorId
          };
          this.idAssignments.push(idAssignment);
          connectorIndex++;
        }
      }
      const chargingStationFuse = this.buildChargingStationFuse(
        fuseID, sumConnectorAmperagePhase1, sumConnectorAmperagePhase2,
        sumConnectorAmperagePhase3, chargingStationChildren);
      fuseID++;
      // Push to fuse tree, if children are not empty
      if (chargingStationFuse.children.length > 0) {
        rootFuse.children.push(chargingStationFuse);
      }
    }
    // Build OptimizerFuse Tree (simple)
    const optimizerFuseTree = {
      rootFuse: rootFuse,
    } as OptimizerFuseTree;
    // Build Event
    const optimizerEventStore: OptimizerEvent = {
      eventType: "Reoptimize",
    };
    // Build State
    const optimizerStateStore: OptimizerState = {
      optimizerFuseTree: optimizerFuseTree,
      cars: cars,
      currentTimeSeconds: currentTimeSeconds,
      chargingStations: chargingStations,
      // Property: maximumSiteLimitKW: siteArea.maximumPower, not useful in this case
      carAssignments: carAssignments,
    };
    // Build request
    const request: OptimizerChargingProfilesRequest = {
      event: optimizerEventStore,
      state: optimizerStateStore,
    };
    return request;
  }

  private buildCar(connectorIndex: number): OptimizerCar {
    // Build "Safe" car
    const car: OptimizerCar = {
      canLoadPhase1: 1,
      canLoadPhase2: 1,
      canLoadPhase3: 1,
      id: connectorIndex,
      timestampArrival: 0,
      carType: "BEV",
      maxCapacity: 75 * 1000 / 230, // Not usable on DC chargers?
      minLoadingState: 75 * 1000 / 230 * 0.5,
      startCapacity: 0,
      minCurrent: 18,
      minCurrentPerPhase: 6,
      maxCurrent: 96,
      maxCurrentPerPhase: 32,
      suspendable: true,
      immediateStart: false,
      canUseVariablePower: true,
    };
    return car;
  }

  private buildChargingStation(connectorIndex: number, connector: Connector): OptimizerChargingStation {
    // Build charging station from connector
    const chargingStation: OptimizerChargingStation = {
      id: connectorIndex,
      fusePhase1: connector.amperage,
      fusePhase2: (connector.numberOfConnectedPhase > 1) ? connector.amperage : 0,
      fusePhase3: (connector.numberOfConnectedPhase > 2) ? connector.amperage : 0,
    };
    return chargingStation;
  }

  private buildCarAssignment(connectorIndex): OptimizerCarAssignment {
    // Build car assignment
    const carAssignment: OptimizerCarAssignment = {
      carID: connectorIndex,
      chargingStationID: connectorIndex
    };
    return carAssignment;
  }

  private buildChargingStationFuse(fuseID: number, sumConnectorAmperagePhase1: number,
      sumConnectorAmperagePhase2: number, sumConnectorAmperagePhase3: number,
      chargingStationChildren: OptimizerChargingStation[]): OptimizerFuse {
    // Each charging station can have multiple connectors (= charge points)
    // A charging station in the optimizer is modelled as a "fuse"
    // A charging station's connectors are modelled as its "children"
    const chargingStationFuse: OptimizerFuse = {
      id: fuseID,
      fusePhase1: sumConnectorAmperagePhase1,
      fusePhase2: sumConnectorAmperagePhase2,
      fusePhase3: sumConnectorAmperagePhase3,
      children: chargingStationChildren,
    };
    return chargingStationFuse;
  }

  private buildChargingProfiles(optimizerResult, currentTimeMinutes: number): ChargingProfile[] {
    const chargingProfiles: ChargingProfile[] = [];
    // Get the last full 15 minutes to set begin of charging profile
    const startSchedule = new Date;
    startSchedule.setUTCMilliseconds(0);
    startSchedule.setSeconds(0);
    startSchedule.setMinutes((Math.floor(startSchedule.getMinutes() / 15)) * 15);
    // Loop through result of optimizer to get each schedule for each car (connector)
    for (const car of optimizerResult.cars) {
      let currentTimeSlot = 0;
      const chargingSchedule = {} as ChargingSchedule;
      chargingSchedule.chargingRateUnit = ChargingRateUnitType.AMPERE;
      chargingSchedule.chargingSchedulePeriod = [];
      chargingSchedule.startSchedule = startSchedule;
      for (let i = Math.floor(currentTimeMinutes / 15); i < Math.floor(currentTimeMinutes / 15) + 3; i++) {
        chargingSchedule.chargingSchedulePeriod.push({
          startPeriod: currentTimeSlot * 15 * 60,
          limit: car.currentPlan[i]
        });
        currentTimeSlot++;
      }
      // Provide third schedule with minimum supported amp of the save car --> duration 60000
      chargingSchedule.chargingSchedulePeriod.push({
        startPeriod: currentTimeSlot * 15 * 60,
        limit: 18
      });
      // Set duration
      chargingSchedule.duration = (currentTimeSlot * 15) * 60 + 60000;
      // Build profile of charging profile
      const profile: Profile = {
        chargingProfileId: this.idAssignments.find((x) => x.generatedId === car.id).connectorId,
        chargingProfileKind: ChargingProfileKindType.ABSOLUTE,
        chargingProfilePurpose: ChargingProfilePurposeType.TX_PROFILE,
        stackLevel: 2,
        chargingSchedule: chargingSchedule
      };
      // Build charging profile with charging station id and connector id
      const chargingProfile: ChargingProfile = {
        id: this.idAssignments.find((x) => x.generatedId === car.id).connectorId,
        chargingStationID: this.idAssignments.find((x) => x.generatedId === car.id).chargingStationId,
        connectorID: this.idAssignments.find((x) => x.generatedId === car.id).connectorId,
        profile: profile
      };
      // Resolve id for charging station and connector from helper array
      chargingProfiles.push(chargingProfile);
    }
    return chargingProfiles;
  }
}
