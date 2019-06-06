import uuid from 'uuid/v4';
import ChargingStationClient from '../../ocpp/ChargingStationClient';

export default class JsonChargingStationClient extends ChargingStationClient {
	
	private wsConnection: any;
	public tagID: any;
	public connectorID: any;
	public chargingProfile: any;
	public type: any;
	public keys: any;
	public key: any;
	public value: any;
	public transactionId: any;
	public connectorId: any;

  constructor(wsConnection) {
    super();
    this.wsConnection = wsConnection;
  }

  getChargeBoxId() {
    return this.wsConnection.getChargeBoxId();
  }

  remoteStartTransaction(params) {
    const { tagID, connectorID, chargingProfile:any = {} } = params;
    const payload: any = {
      connectorId: connectorID,
      idTag: tagID
    };
    if (this.chargingProfile !== null && Object.getOwnPropertyNames(this.chargingProfile).length > 0) {
      payload.chargingProfile = this.chargingProfile;
    }
    return this.wsConnection.sendMessage(uuid(), payload, 2, "RemoteStartTransaction");
  }

  reset(params) {
    const { type } = params;
    return this.wsConnection.sendMessage(uuid(), {
      type: type
    }, 2, "Reset");
  }

  clearCache() {
    return this.wsConnection.sendMessage(uuid(), {}, 2, "ClearCache");
  }

  getConfiguration(params) {
    const { keys } = params;
    return this.wsConnection.sendMessage(uuid(), ((keys === null) ? {} : {
      key: keys
    }), 2, "GetConfiguration");
  }

  changeConfiguration(params) {
    const { key, value } = params;
    return this.wsConnection.sendMessage(uuid(), {
      key: key,
      value: value
    }, 2, "ChangeConfiguration");
  }

  remoteStopTransaction(params) {
    const { transactionId } = params;
    return this.wsConnection.sendMessage(uuid(), {
      transactionId: transactionId
    }, 2, "RemoteStopTransaction");
  }

  unlockConnector(params) {
    const { connectorId } = params;
    return this.wsConnection.sendMessage(uuid(), {
      connectorId: connectorId
    }, 2, "UnlockConnector");
  }

  setChargingProfile(params) {
    return this.wsConnection.sendMessage(uuid(), params, 2, "SetChargingProfile");
  }

  getCompositeSchedule(params) {
    return this.wsConnection.sendMessage(uuid(), params, 2, "GetCompositeSchedule");
  }

  genericOCPPCommand(commandName, params) {
    return this.wsConnection.sendMessage(uuid(), params, 2, commandName);
  }

  clearChargingProfile(params) {
    return this.wsConnection.sendMessage(uuid(), params, 2, "ClearChargingProfile");
  }

  changeAvailability(params) {
    return this.wsConnection.sendMessage(uuid(), params, 2, "ChangeAvailability");
  }

  getDiagnostics(params) {
    return this.wsConnection.sendMessage(uuid(), params, 2, "GetDiagnostics");
  }

  updateFirmware(params) {
    return this.wsConnection.sendMessage(uuid(), params, 2, "UpdateFirmware");
  }

}
