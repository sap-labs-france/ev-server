const ChargingStationClient = require('../ChargingStationClient');
const soap = require('strong-soap').soap;
const Logging = require('../../utils/Logging');
const Configuration = require('../../utils/Configuration');

// Default Module name
const _moduleName = "SoapChargingStationClient";
// Get the config
const _wsdlEndpointConfig = Configuration.getWSDLEndpointConfig();		

class SoapChargingStationClient extends ChargingStationClient {
	constructor(chargingStation) {
		super();
		// Keep the charger
		this.chargingStation = chargingStation;
		// Get the Charging Station
		return new Promise((fulfill, reject) => {
			let chargingStationWdsl = null;
			// Read the WSDL client files
			switch(this.chargingStation.getOcppVersion()) {
				// OCPP V1.2
				case "1.2":
					chargingStationWdsl = _wsdlEndpointConfig.baseUrl + '/wsdl/OCPPChargePointService12.wsdl';
					break;
				case "1.5":
					chargingStationWdsl = _wsdlEndpointConfig.baseUrl + '/wsdl/OCPPChargePointService15.wsdl';
					break;
				case "1.6":
					chargingStationWdsl = _wsdlEndpointConfig.baseUrl + '/wsdl/OCPPChargePointService16.wsdl';
					break;
				default:
					// Log
					Logging.logError({
						module: "SoapChargingStationClient", method: "constructor",
						message: `OCPP version ${this.chargingStation.getOcppVersion()} not supported` });
					reject(`OCPP version ${this.chargingStation.getOcppVersion()} not supported`);
			}			
			// Client options
			const options = {};
			// Create client
			soap.createClient(chargingStationWdsl, options, (error, client) => {
				if (error) {
					// Log
					Logging.logError({
						source: this.chargingStation.getID(),
						module: "SoapChargingStationClient", method: "constructor",
						message: `Error when creating SOAP client: ${error.toString()}`,
						detailedMessages: error.stack });
					reject(`Error when creating SOAP client for chaging station with ID ${this.chargingStation.getID()}: ${error.message}`);
				} else {
					// Keep
					this._client = client;
					// Set endpoint
					this._client.setEndpoint(this.chargingStation.getChargingStationURL());
					// Ok
					fulfill(this);
				}
			});
		});
	}

	initSoapHeaders(action) {
		// Clear the SOAP Headers`
		this._client.clearSoapHeaders();
		// Add them
    this._client.addSoapHeader(`<h:chargeBoxIdentity xmlns:h="urn://Ocpp/Cp/2012/06/">${this.chargingStation.getID()}</h:chargeBoxIdentity>`);
		this._client.addSoapHeader(`<a:Action xmlns:a="http://www.w3.org/2005/08/addressing">/${action}</a:Action>`);
	}

	async remoteStopTransaction(params) {
    const { transactionId } = params;
    // Init SOAP Headers with the action
    this.initSoapHeaders("RemoteStopTransaction");
    // Log
    Logging.logSendAction(_moduleName, this.chargingStation.getID(), "RemoteStopTransaction", [transactionId, { headers: this._client.getSoapHeaders() }]);
    // Execute
    const {error, result, envelope} = await this._client.RemoteStopTransaction({
        "remoteStopTransactionRequest": {
          "transactionId": transactionId
      }
    });
    if (error) {
      // Log
      Logging.logError({
        source: this.chargingStation.getID(), module: "SoapChargingStationClient", method: "stopTransaction",
        message: `Error when trying to stop the transaction ID ${transactionId}: ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result }, 
          { envelope } 
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(_moduleName, this.chargingStation.getID(), "RemoteStopTransaction", [
      { result }, 
      { envelope } 
    ]);
    return result;
	}

	async startTransaction(params) {
    const { tagID, connectorID } = params;
    // Init SOAP Headers with the action
    this.initSoapHeaders("RemoteStartTransaction");
    // Log
    Logging.logSendAction(_moduleName, this.chargingStation.getID(), "RemoteStartTransaction", [{
        "idTag": tagID,
        "connectorId": connectorID
      }, { headers: this._client.getSoapHeaders() }]
    );
    // Execute
    const {error, result, envelope} = await this._client.RemoteStartTransaction({
      "remoteStartTransactionRequest": {
        "idTag": tagID,
        "connectorId": connectorID
      }
    });
    if (error) {
      // Log
      Logging.logError({
        source: this.chargingStation.getID(), module: "SoapChargingStationClient", method: "startTransaction",
        message: `Error when trying to start a transaction: ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result }, 
          { envelope } 
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(_moduleName, this.chargingStation.getID(), "RemoteStartTransaction", [
      { result }, 
      { envelope } 
    ]);
    return result;
	}

	async unlockConnector(params) {
    const { connectorId } = params;
    // Init SOAP Headers with the action
    this.initSoapHeaders("UnlockConnector");
    // Log
    Logging.logSendAction(_moduleName, this.chargingStation.getID(), "UnlockConnector", [connectorId, { headers: this._client.getSoapHeaders() }]);
    // Execute
    const {error, result, envelope} = await this._client.UnlockConnector({
        "unlockConnectorRequest": {
          "connectorId": connectorId
      }
    });
    if (error) {
      // Log
      Logging.logError({
        source: this.chargingStation.getID(), module: "SoapChargingStationClient", method: "unlockConnector",
        message: `Error when trying to unlock the connector '${connectorId}': ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result }, 
          { envelope } 
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(_moduleName, this.chargingStation.getID(), "UnlockConnector", [
      { result }, 
      { envelope } 
    ]);
    return result;
	}

	async reset(params) {
    const { type } = params;
    // Init SOAP Headers with the action
    this.initSoapHeaders("Reset");
    // Log
    Logging.logSendAction(_moduleName, this.chargingStation.getID(), "Reset", [type, { headers: this._client.getSoapHeaders() }]);
    // Execute
    const {error, result, envelope} = await this._client.Reset({
      "resetRequest": {
        "type": type
      }
    });
    if (error) {
      // Log
      Logging.logError({
        source: this.chargingStation.getID(), module: "SoapChargingStationClient", method: "reset",
        message: `Error when trying to reboot: ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result }, 
          { envelope } 
        ]
      });
      return error;
    }
    // Log
    Logging.logReturnedAction(_moduleName, this.chargingStation.getID(), "Reset", [
      { result }, 
      { envelope } 
    ]);
    return result;
	}

	async clearCache() {
    // Init SOAP Headers with the action
    this.initSoapHeaders("ClearCache");
    // Log
    Logging.logSendAction(_moduleName, this.chargingStation.getID(), "ClearCache", { headers: this._client.getSoapHeaders() });
    // Execute
    const {error, result, envelope} = await this._client.ClearCache({clearCacheRequest: {}});
    if (error) {
      // Log
      Logging.logError({
        source: this.chargingStation.getID(), module: "SoapChargingStationClient", method: "clearCache",
        message: `Error when trying to clear the cache: ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result }, 
          { envelope } 
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(_moduleName, this.chargingStation.getID(), "ClearCache", [
      { result }, 
      { envelope } 
    ]);
    return result;
	}

	async getConfiguration(params) {
    const { keys } = params;
    // Init SOAP Headers with the action
    this.initSoapHeaders("GetConfiguration");
    // Log
    Logging.logSendAction(_moduleName, this.chargingStation.getID(), "GetConfiguration", [keys, { headers: this._client.getSoapHeaders() }]);
    // Set request
    let request = {
      "getConfigurationRequest": {}
    };
    // Key provided?
    if(keys) {
      // Set the keys
      request.getConfigurationRequest.key = keys;
    }
    // Execute
    const {error, result, envelope} = await this._client.GetConfiguration(request);
    if (error) {
      // Log
      Logging.logError({
        source: this.chargingStation.getID(), module: "SoapChargingStationClient", method: "getConfiguration",
        message: `Error when trying to get the configuration: ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result }, 
          { envelope } 
        ]
      });
      throw error;
		}
    // Log
    Logging.logReturnedAction(_moduleName, this.chargingStation.getID(), "GetConfiguration", [
      { result }, 
      { envelope } 
    ]);
    return result;
	}

	async changeConfiguration(params) {
    const { key, value } = params;
    // Init SOAP Headers with the action
    this.initSoapHeaders("ChangeConfiguration");
    // Log
    Logging.logSendAction(_moduleName, this.chargingStation.getID(), "ChangeConfiguration", [{"key": key, "value": value}, { headers: this._client.getSoapHeaders() }]);
    // Execute
    const {error, result, envelope} = await this._client.ChangeConfiguration({
      "changeConfigurationRequest": {
        "key": key,
        "value": value
      }
    });
    if (error) {
      // Log
      Logging.logError({
        source: this.chargingStation.getID(), module: "SoapChargingStationClient", method: "changeConfiguration",
        message: `Error when trying to change the configuration parameter '${key}' with value '${value}': ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result }, 
          { envelope } 
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(_moduleName, this.chargingStation.getID(), "ChangeConfiguration", [
      { result }, 
      { envelope } 
    ]);
    return result;
	}

	getChargingStation() {
		return this.chargingStation;
	}
}

module.exports = SoapChargingStationClient;
