import ChargingStation, { Connector } from '../../types/ChargingStation';

export default class OICPUtils {

  /**
   * Build evse_id from charging station
   * @param {*} countryCode the code of the CPO
   * @param {*} partyId the partyId of the CPO
   * @param {*} chargingStation the charging station used to build the evse ID
   * @param {*} connector the connector used to build the evse id
   */
  public static buildEvseID(countryCode: string, partyId: string, chargingStation: ChargingStation, connector?: Connector): string {
    let evseID = `${countryCode}*${partyId}*E${chargingStation.id}`;
    if (!connector) {
      for (const _connector of chargingStation.connectors) {
        if (_connector) {
          connector = _connector;
          break;
        }
      }
    }
    evseID = `${evseID}*${connector.connectorId}`;
    return evseID.replace(/[\W_]+/g, '*').toUpperCase();
  }
}
