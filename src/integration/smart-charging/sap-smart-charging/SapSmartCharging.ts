/* eslint-disable quotes */
import { Car, CarAssignmentStore, ChargingStation, ChargingStationStore, EventStore, Fuse, FuseTree, OptimizeChargingProfilesRequest, StateStore } from '../../../types/Optimizer';
import { ChargingProfile, ChargingProfileKindType, ChargingProfilePurposeType, ChargingRateUnitType, ChargingSchedule, ChargingSchedulePeriod, Profile } from '../../../types/ChargingProfile';
import { Action } from '../../../types/Authorization';
import Axios from 'axios';
import { ChargePointStatus } from '../../../types/ocpp/OCPPServer';
import { Connector } from '../../../types/ChargingStation';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import moment = require('moment');
import { SapSmartChargingSetting } from '../../../types/Setting';
import SiteArea from '../../../types/SiteArea';
import SmartCharging from '../SmartCharging';

export default class SapSmartCharging extends SmartCharging<SapSmartChargingSetting> {

  // Helper to resolve generated IDs, Charging Station IDs and Connector IDs --> Oliver is asked to implement String ID Property
  private idAssignments = [];

  public constructor(tenantID: string, setting: SapSmartChargingSetting) {
    super(tenantID, setting);
  }

  public async getChargingProfiles(siteArea: SiteArea): Promise<ChargingProfile[]> {
    // Optimizer implementation:

    // Get seconds since midnight
    // Moment
    const mmt = moment();
    // Moment at midnight
    const mmtMidnight = mmt.clone().startOf('day');
    // Difference in seconds
    const currentTimeSeconds = mmt.diff(mmtMidnight, 'seconds');

    try {
      // Call Optimizer
      const response = await Axios.post(this.buildUrl(), this.buildRequest(siteArea, currentTimeSeconds), {
        headers: {
          Accept: "application/json",
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


  private buildRequest(siteArea: SiteArea, currentTimeSeconds: number): OptimizeChargingProfilesRequest {
    // Instantiate initial arrays for request
    const cars: Car[] = [];
    const carAssignments: CarAssignmentStore[] = [];
    const chargingStations: ChargingStationStore[] = [];

    // Create indices to generate IDs in number format
    let fuseID = 1; // Start at 1 because root fuse will have ID=0
    let connectorIndex = 0; // Connector Index to give IDs of format: number

    if (!siteArea.maximumPower) {
      Logging.logError({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Action.CALL_OPTIMIZER,
        module: 'SapSmartCharging',
        method: 'getChargingProfiles',
        message: 'Maximum Power property is not set for site area'
      });
      return null;
    }
    // Create root fuse
    const rootFuse: Fuse = {
      "@type": "Fuse",
      id: 0,
      fusePhase1: siteArea.maximumPower / (230 * 3),
      fusePhase2: siteArea.maximumPower / (230 * 3),
      fusePhase3: siteArea.maximumPower / (230 * 3),
      children: [],
    };


    if (!siteArea.chargingStations) {
      Logging.logError({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Action.CALL_OPTIMIZER,
        module: 'SapSmartCharging',
        method: 'getChargingProfiles',
        message: 'No charging stations on site area'
      });
      return null;
    }
    // Loop through charging stations to get each connector
    for (const chargingStation of siteArea.chargingStations) {

      // Create helper to build fuse tree
      let sumConnectorAmperagePhase1 = 0;
      let sumConnectorAmperagePhase2 = 0;
      let sumConnectorAmperagePhase3 = 0;
      const chargingStationChildren = [];

      // Loop through connectors to generate Cars, charging stations and car assignments for request
      if (chargingStation.connectors) {
        for (const connector of chargingStation.connectors) {
          // Check if connector is charging
          if (connector.status === ChargePointStatus.CHARGING || connector.status === ChargePointStatus.PREPARING || connector.status === ChargePointStatus.SUSPENDED_EV ||
            connector.status === ChargePointStatus.SUSPENDED_EVSE) { // + occupied??

            cars.push(this.buildCar(connectorIndex));

            chargingStations.push(this.buildChargingStationStore(connectorIndex, connector));

            carAssignments.push(this.buildCarAssignmentStore(connectorIndex));

            // Build Charging Station children for fuse tree
            const chargingStationChildrenStore = this.buildChargingStationChildren(connectorIndex, connector);
            chargingStationChildren.push(chargingStationChildrenStore);

            sumConnectorAmperagePhase1 += chargingStationChildrenStore.fusePhase1;
            sumConnectorAmperagePhase2 += chargingStationChildrenStore.fusePhase2;
            sumConnectorAmperagePhase3 += chargingStationChildrenStore.fusePhase3;


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
      }
      const chargingStationFuse = this.buildChargingStationFuse(fuseID, sumConnectorAmperagePhase1, sumConnectorAmperagePhase2,
        sumConnectorAmperagePhase3, chargingStationChildren);
      fuseID++;
      // Push to fuse tree, if children are not empty
      if (chargingStationFuse.children.length > 0) {
        rootFuse.children.push(chargingStationFuse);
      }
    }

    // Build Fuse Tree (simple)
    const fuseTree = {
      rootFuse: rootFuse,
    } as FuseTree;

    // Build Event
    const eventStore: EventStore = {
      eventType: "Reoptimize",
    };

    // Build State
    const stateStore: StateStore = {
      fuseTree: fuseTree,
      cars: cars,
      currentTimeSeconds: currentTimeSeconds,
      chargingStations: chargingStations,
      // Property: maximumSiteLimitKW: siteArea.maximumPower, not useful in this case
      carAssignments: carAssignments,
    };

    // Build request
    const request: OptimizeChargingProfilesRequest = {
      event: eventStore,
      state: stateStore,
    };
    return request;
  }

  private buildCar(connectorIndex: number): Car {
    // Build "save" car
    const car: Car = {
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

  private buildChargingStationStore(connectorIndex: number, connector: Connector): ChargingStationStore {
    // Build charging station from connector
    const chargingStationStore: ChargingStationStore = {
      id: connectorIndex,
      fusePhase1: connector.amperage,
      fusePhase2: (connector.numberOfConnectedPhase > 1) ? connector.amperage : 0,
      fusePhase3: (connector.numberOfConnectedPhase > 2) ? connector.amperage : 0,
    };
    return chargingStationStore;
  }

  private buildCarAssignmentStore(connectorIndex): CarAssignmentStore {
    // Build car assignment
    const carAssignmentStore: CarAssignmentStore = {
      carID: connectorIndex,
      chargingStationID: connectorIndex
    };
    return carAssignmentStore;
  }

  private buildChargingStationChildren(connectorIndex: number, connector: Connector) {
    const chargingStationOptimizer: ChargingStation = {
      "@type": "ChargingStation",
      id: connectorIndex,
      fusePhase1: connector.amperage, // Per phase??
      fusePhase2: (connector.numberOfConnectedPhase > 1) ? connector.amperage : 0,
      fusePhase3: (connector.numberOfConnectedPhase > 2) ? connector.amperage : 0,
    };
    return chargingStationOptimizer;
  }

  private buildChargingStationFuse(fuseID: number, sumConnectorAmperagePhase1: number, sumConnectorAmperagePhase2: number, sumConnectorAmperagePhase3: number,
    chargingStationChildren: ChargingStation[]): Fuse {
    // Each charge station can have multiple connectors (=charge points)
    // A charge station in the optimizer is modelled as a "fuse"
    // A charge station's connectors are modelled as its "children"
    const chargingStationFuse: Fuse = {
      "@type": "Fuse",
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
        const chargingSchedulePeriod = { startPeriod: currentTimeSlot * 15 * 60, limit: car.currentPlan[i] } as ChargingSchedulePeriod;
        chargingSchedule.chargingSchedulePeriod.push(chargingSchedulePeriod);
        currentTimeSlot++;
      }
      // Provide third schedule with minimum supported amp of the save car --> duration 60000
      chargingSchedule.chargingSchedulePeriod.push({ startPeriod: currentTimeSlot * 15 * 60, limit: 18 });

      // Set duration
      chargingSchedule.duration = (currentTimeSlot * 15) * 60 + 60000;

      // Build profile of charging profile
      const profile = {} as Profile;
      profile.chargingProfileId = this.idAssignments.find((x) => x.generatedId === car.id).connectorId;
      profile.chargingProfileKind = ChargingProfileKindType.ABSOLUTE;
      profile.chargingProfilePurpose = ChargingProfilePurposeType.TX_PROFILE;
      profile.stackLevel = 2;
      profile.chargingSchedule = chargingSchedule;

      // Build charging profile with charging station id and connector id
      const chargingProfile = {} as ChargingProfile;
      // Resolve id for charging station and connector from helper array
      chargingProfile.chargingStationID = this.idAssignments.find((x) => x.generatedId === car.id).chargingStationId;
      chargingProfile.connectorID = this.idAssignments.find((x) => x.generatedId === car.id).connectorId;
      chargingProfile.id = this.idAssignments.find((x) => x.generatedId === car.id).connectorId;
      chargingProfile.profile = profile;

      chargingProfiles.push(chargingProfile);
    }

    return chargingProfiles;
  }
}
