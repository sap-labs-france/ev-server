import axios from 'axios';
import AbstractConnector from '../../AbstractConnector';
import AppError from '../../../exception/AppError';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Site from '../../../types/Site';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import BackendError from '../../../exception/BackendError';;
import SmartChargingConnector from '../SmartChargingConnector';
import ChargingStationService from '../../../server/rest/service/ChargingStationService';

const MODULE_NAME = 'sapSmartChargingConnector';
const CONNECTOR_ID = 'sapSmartCharging';

export default class SapSmartChargingConnector extends AbstractConnector implements SmartChargingConnector {

  async callOptimizer() {
    try {
      const response = await axios.post('https://user1:BE4kpTZHkCpMMVj38zpj@tradeevschargingoptimizeropensource.cfapps.eu10.hana.ondemand.com/api/v1/OptimizeChargingProfiles/', {
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
              "fusePhase1": 144,
              "fusePhase2": 144,
              "fusePhase3": 144,
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
      return response.data.ID;
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
    }
  }
}
