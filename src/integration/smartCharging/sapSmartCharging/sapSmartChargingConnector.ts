import axios from 'axios';
import AbstractConnector from '../../AbstractConnector';
import AppError from '../../../exception/AppError';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import Site from '../../../types/Site';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import BackendError from '../../../exception/BackendError';
import SettingStorage from '../../../storage/mongodb/SettingStorage';
import SmartChargingConnector from '../SmartChargingConnector';
import ChargingStationService from '../../../server/rest/service/ChargingStationService';
import SmartChargingFactory from '../SmartChargingFactory';

const MODULE_NAME = 'sapSmartChargingConnector';
const CONNECTOR_ID = 'sapSmartCharging';

export default class SapSmartChargingConnector extends AbstractConnector implements SmartChargingConnector {
  constructor(tenantID, setting) {
    super(tenantID, 'smartCharging', setting);
  }

  async callOptimizer(tenantID: string) {

    if (!this.getSettings()) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'No settings defined for Smart Charging',
        module: MODULE_NAME,
        method: 'callOptimizer',
        action: 'smartCharging'
      })
    }

    // Build URL
    const url = this.getOptimizerUrl();
    const user = this.getUser();
    const password = this.getPassword();
    const requestUrl = url.slice(0, 8) + user + ":" + password + '@' + url.slice(8);

    // Get site area limit
    const siteAreas = await SiteAreaStorage.getSiteAreas(tenantID,{},
      { limit: 10, skip: 0 },
      ['id', 'name', 'siteID', 'maximumPower']
    )

    siteAreas.result.forEach(async siteArea =>{
      try {
        const response = await axios.post(requestUrl, {
          "event": {
            "eventType": "Reoptimize"
          },
          "state": {
            "currentTimeSeconds": 43200,
            "cars": [
              {
                "id": 0,
                "canLoadPhase1": 1,
                "canLoadPhase2": 1,
                "canLoadPhase3": 1,
                "timestampArrival": 28800,
                "carType": "BEV",
                "maxCapacity": 100,
                "minLoadingState": 50,
                "startCapacity": 10,
                "minCurrent": 18,
                "minCurrentPerPhase": 6,
                "maxCurrent": 96,
                "maxCurrentPerPhase": 32
              }
            ],
            "fuseTree": {
              "rootFuse": {
                "@type": "Fuse",
                "id": 0,
                "fusePhase1": siteArea.maximumPower/400,
                "fusePhase2": siteArea.maximumPower/400,
                "fusePhase3": siteArea.maximumPower/400,
                "children": [
                  {
                    "@type": "Fuse",
                    "id": 1,
                    "fusePhase1": 77,
                    "fusePhase2": 77,
                    "fusePhase3": 77,
                    "children": [
                      {
                        "@type": "ChargingStation",
                        "id": 0,
                        "fusePhase1": 32,
                        "fusePhase2": 32,
                        "fusePhase3": 32
                      },
                      {
                        "@type": "ChargingStation",
                        "id": 1,
                        "fusePhase1": 32,
                        "fusePhase2": 32,
                        "fusePhase3": 32
                      }
                    ]
                  }
                ]
              }
            },
            "carAssignments": [
              {
                "carID": 0,
                "chargingStationID": 0
              }
            ]
          }
        }, {
          headers: {
            Accept: 'application/json',
          }
        });
        console.log(response.data);
      } catch (error) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: 'Unable to call Optimizer',
          module: MODULE_NAME,
          method: 'callOptimizer',
          action: 'smartCharging',
          detailedMessages: error
        });
      }})

  }

  getSettings() {
    return this.getSetting();
  }

  getOptimizerUrl() {
    return this.getSetting().optimizerUrl;
  }

  getUser() {
    return this.getSetting().user;
  }

  getPassword() {
    return Cypher.decrypt(this.getSetting().password);
  }
}
