/* eslint-disable quotes */
import { ChargingProfile, Profile, ChargingProfileKindType, ChargingProfilePurposeType, ChargingSchedule, ChargingRateUnitType, ChargingSchedulePeriod } from '../../../types/ChargingProfile';
import { SapSmartChargingSetting } from '../../../types/Setting';
import SiteArea from '../../../types/SiteArea';
import SmartCharging from '../SmartCharging';
import Axios from 'axios';
import Cypher from '../../../utils/Cypher';
import { Action } from '../../../types/Authorization';
import { HTTPError } from '../../../types/HTTPError';
import Logging from '../../../utils/Logging';
import Constants from '../../../utils/Constants';
import { OptimizeChargingProfilesRequest, Car, StateStore, EventStore, ChargingStationStore, CarAssignmentStore, FuseTree, Fuse } from '../../../types/Optimizer';
import { ChargePointStatus } from '../../../types/ocpp/OCPPServer';
import moment = require('moment');

export default class SapSmartCharging extends SmartCharging<SapSmartChargingSetting> {
  public constructor(tenantID: string, setting: SapSmartChargingSetting) {
    super(tenantID, setting);
  }

  public async getChargingProfiles(siteArea: SiteArea): Promise<ChargingProfile[]> {
    // Optimizer implementation

    // Build URL
    const url = this.setting.optimizerUrl;
    const user = this.setting.user;
    const password = Cypher.decrypt(this.setting.password);
    const requestUrl = url.slice(0, 8) + user + ':' + password + '@' + url.slice(8);

    // Instantiate initial arrays for request
    const cars: Car[] = [];
    const carAssignments: CarAssignmentStore[] = [];
    const chargingStations: ChargingStationStore[] = [];
    const idAssignments = [];
    // Moment
    const mmt = moment();
    // Moment at midnight
    const mmtMidnight = mmt.clone().startOf('day');
    // Difference in seconds
    const currentTimeSeconds = mmt.diff(mmtMidnight, 'seconds');

    // Instantiate helper to generate int IDs for charging stations (connectors) and cars
    let index = 0;

    // Loop through charging stations to get each connector
    for (const chargingStation of siteArea.chargingStations) {
      // Loop through connectors to generate Cars, charging stations and car assignments for request
      for (const [i, connector] of chargingStation.connectors.entries()) {
        // Check if connector is charging
        if (connector.status === ChargePointStatus.CHARGING || connector.status === ChargePointStatus.PREPARING) {

          // Build "save" car
          const car = {
            canLoadPhase1: 1,
            canLoadPhase2: 1,
            canLoadPhase3: 1,
            id: index,
            timestampArrival: 0,
            carType: "BEV",
            maxCapacity: 75 * 100 / 230,
            minLoadingState: 75 * 1000 / 230 * 0.5,
            startCapacity: 0,
            minCurrent: 18,
            minCurrentPerPhase: 6,
            maxCurrent: 96,
            maxCurrentPerPhase: 32
          } as Car;
          cars.push(car);

          // Build charging station from connector
          const chargingStationStore = {
            "@type": "ChargingStation",
            id: index,
            fusePhase1: connector.amperage,
            fusePhase2: connector.amperage,
            fusePhase3: connector.amperage,
          } as ChargingStationStore;
          chargingStations.push(chargingStationStore);

          // Build car assignment
          const carAssignmentStore = {
            carID: index,
            chargingStationID: index
          } as CarAssignmentStore;
          carAssignments.push(carAssignmentStore);

          // Build helper to know, which charging station has which generated id
          const idAssignment = {
            generatedId: index,
            chargingStationId: chargingStation.id,
            connectorId: i
          };
          idAssignments.push(idAssignment);

          index++;
        }

      }
    }

    // Create simple fuse tree
    const rootFuse = {
      "@type": "Fuse",
      id: 1,
      fusePhase1: siteArea.maximumPower / (230 * 3),
      fusePhase2: siteArea.maximumPower / (230 * 3),
      fusePhase3: siteArea.maximumPower / (230 * 3),
      children: chargingStations,
    } as Fuse;

    const fuseTree = {
      rootFuse: rootFuse,
    } as FuseTree;

    // Build Event
    const eventStore = {
      eventType: "Reoptimize",
    } as EventStore;

    // Build State
    const stateStore = {
      fuseTree: fuseTree,
      cars: cars,
      currentTimeSeconds: currentTimeSeconds,
      chargingStations: chargingStations,
      maximumSiteLimitKW: siteArea.maximumPower,
      carAssignments: carAssignments,
    } as StateStore;

    try {
      // Build request
      const request = {
        event: eventStore,
        state: stateStore,
      } as OptimizeChargingProfilesRequest;

      console.log(JSON.stringify(request));

      // Call Optimizer
      const response = await Axios.post(requestUrl, request, {
        headers: {
          Accept: "application/json",
        }
      });
      // Build charging profiles from result
      return this.buildChargingProfiles(response.data, idAssignments, currentTimeSeconds * 60);

    } catch (error) {
      Logging.logError({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Action.CALL_OPTIMIZER,
        module: 'SapSmartCharging',
        method: 'getChargingProfiles',
        message: 'Unable to call Optimizer'
      });
      console.log(error);
    }
  }

  private buildChargingProfiles(optimizerResult, idAssignments: any[], currentTimeMinutes: number): ChargingProfile[] {

    const chargingProfiles: ChargingProfile[] = [];

    // Loop through result of optimizer to get each schedule for each car (connector)
    for (const car of optimizerResult.cars) {
      let timeSlot = 0;
      const chargingSchedule = {} as ChargingSchedule;
      chargingSchedule.chargingRateUnit = ChargingRateUnitType.AMPERE;
      chargingSchedule.chargingSchedulePeriod = [];
      chargingSchedule.startSchedule = new Date;
      for (const currentPlan of car.currentPlan) {
        const chargingSchedulePeriod = { startPeriod: timeSlot * 60, limit: currentPlan } as ChargingSchedulePeriod;
        chargingSchedule.chargingSchedulePeriod.push(chargingSchedulePeriod);
        timeSlot = timeSlot + 15;
      }

      // Build profile of charging profile
      const profile = {} as Profile;
      profile.chargingProfileId = idAssignments.find((x) => x.generatedId === car.id).connectorId;
      profile.chargingProfileKind = ChargingProfileKindType.ABSOLUTE;
      profile.chargingProfilePurpose = ChargingProfilePurposeType.TX_DEFAULT_PROFILE;
      profile.stackLevel = 2;
      profile.chargingSchedule = chargingSchedule;

      // Build charging profile with charging station id and connector id
      const chargingProfile = {} as ChargingProfile;
      // Resolve id for charging station and connector from helper array
      chargingProfile.chargingStationID = idAssignments.find((x) => x.generatedId === car.id).chargingStationId;
      chargingProfile.connectorID = idAssignments.find((x) => x.generatedId === car.id).connectorId;
      chargingProfile.id = idAssignments.find((x) => x.generatedId === car.id).connectorId;
      chargingProfile.profile = profile;

      chargingProfiles.push(chargingProfile);
    }

    console.log(chargingProfiles);
    return chargingProfiles;
  }
}
