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
		this._chargingStation = chargingStation;
		// Get the Charging Station
		return new Promise((fulfill, reject) => {
			let chargingStationWdsl = null;
			// Read the WSDL client files
			switch(this._chargingStation.getOcppVersion()) {
				// OCPP V1.2
				case "1.2":
					chargingStationWdsl = _wsdlEndpointConfig.baseUrl + '/wsdl/OCPP_ChargePointService1.2.wsdl';
					break;
				case "1.5":
					chargingStationWdsl = _wsdlEndpointConfig.baseUrl + '/wsdl/OCPP_ChargePointService1.5.wsdl';
					break;
				case "1.6":
					chargingStationWdsl = _wsdlEndpointConfig.baseUrl + '/wsdl/OCPP_ChargePointService1.6.wsdl';
					break;
				default:
					// Log
					Logging.logError({
						module: "SoapChargingStationClient", method: "constructor",
						message: `OCPP version ${this._chargingStation.getOcppVersion()} not supported` });
					reject(`OCPP version ${this._chargingStation.getOcppVersion()} not supported`);
			}			
			// Client options
			const options = {};
			// Create client
			soap.createClient(chargingStationWdsl, options, (err, client) => {
				if (err) {
					// Log
					Logging.logError({
						source: this._chargingStation.getID(),
						module: "SoapChargingStationClient", method: "constructor",
						message: `Error when creating SOAP client: ${err.toString()}`,
						detailedMessages: err.stack });
					reject(`Error when creating SOAP client for chaging station with ID ${this._chargingStation.getID()}: ${err.message}`);
				} else {
					// Keep
					this._client = client;
					// Set endpoint
					this._client.setEndpoint(this._chargingStation.getChargingStationURL());
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
		this._client.addSoapHeader(`<h:chargeBoxIdentity xmlns:h="urn://Ocpp/Cp/2012/06/">${this._chargingStation.getID()}</h:chargeBoxIdentity>`);
		this._client.addSoapHeader(`<a:MessageID xmlns:a="http://www.w3.org/2005/08/addressing">urn:uuid:589e13ae-1787-49f8-ab8b-4567327b23c6</a:MessageID>`);
		this._client.addSoapHeader(`<a:ReplyTo xmlns:a="http://www.w3.org/2005/08/addressing"><a:Address>http://www.w3.org/2005/08/addressing/anonymous</a:Address></a:ReplyTo>`);
		this._client.addSoapHeader(`<a:To xmlns:a="http://www.w3.org/2005/08/addressing">${this._chargingStation.getChargingStationURL()}</a:To>`);
		this._client.addSoapHeader(`<a:Action xmlns:a="http://www.w3.org/2005/08/addressing">/${action}</a:Action>`);
		this._client.addSoapHeader(`<a:From xmlns:a="http://www.w3.org/2005/08/addressing"><a:Address>${_wsdlEndpointConfig.baseUrl}</a:Address></a:From>`);
	}

	stopTransaction(transactionId) {
		return new Promise((fulfill, reject) => {
			// Init SOAP Headers with the action
			this.initSoapHeaders("RemoteStopTransaction");

			// Log
			Logging.logSendAction(_moduleName, this._chargingStation.getID(), "RemoteStopTransaction", transactionId);

			// Execute
			this._client.RemoteStopTransaction({
					"remoteStopTransactionRequest": {
						"transactionId": transactionId
				}
			}, (err, result, envelope) => {
				if(err) {
					// Log
					Logging.logError({
						source: this._chargingStation.getID(), module: "SoapChargingStationClient", method: "stopTransaction",
						message: `Error when trying to stop the transaction ID ${transactionId}: ${err.toString()}`,
						detailedMessages: [
							{ 'stack': err.stack },
							{ 'result': result }, 
							{ 'envelope': envelope } 
						]
					});
					reject(err);
				} else {
					// Log
					Logging.logReturnedAction(_moduleName, this._chargingStation.getID(), "RemoteStopTransaction", result);
					fulfill(result);
				}
			});
		});
	}

	startTransaction(tagID, connectorID) {
		return new Promise((fulfill, reject) => {
			let meterStart = 0;
			let timestamp = new Date().toISOString();

			// Init SOAP Headers with the action
			this.initSoapHeaders("RemoteStartTransaction");

			// Log
			Logging.logSendAction(_moduleName, this._chargingStation.getID(), "RemoteStartTransaction", {
				"idTag": tagID,
				"connectorId": connectorID
			});
			// Execute
			this._client.RemoteStartTransaction({
						"remoteStartTransactionRequest": {
							"idTag": tagID,
							"connectorId": connectorID
						}
				}, (err, result, envelope) => {
					if(err) {
						// Log
						Logging.logError({
							source: this._chargingStation.getID(), module: "SoapChargingStationClient", method: "startTransaction",
							message: `Error when trying to start a transaction: ${err.toString()}`,
							detailedMessages: [
								{ 'stack': err.stack },
								{ 'result': result }, 
								{ 'envelope': envelope } 
							]
						});
						reject(err);
					} else {
						// Log
						Logging.logReturnedAction(_moduleName, this._chargingStation.getID(), "RemoteStartTransaction", result);
						fulfill(result);
					}
				});
		});
	}

	unlockConnector(connectorId) {
		return new Promise((fulfill, reject) => {
			// Init SOAP Headers with the action
			this.initSoapHeaders("UnlockConnector");

			// Log
			Logging.logSendAction(_moduleName, this._chargingStation.getID(), "UnlockConnector", connectorId);

			// Execute
			this._client.UnlockConnector({
					"unlockConnectorRequest": {
						"connectorId": connectorId
				}
			}, (err, result, envelope) => {
				if(err) {
					// Log
					Logging.logError({
						source: this._chargingStation.getID(), module: "SoapChargingStationClient", method: "unlockConnector",
						message: `Error when trying to unlock the connector '${connectorId}': ${err.toString()}`,
						detailedMessages: [
							{ 'stack': err.stack },
							{ 'result': result }, 
							{ 'envelope': envelope } 
						]
					});
					reject(err);
				} else {
					// Log
					Logging.logReturnedAction(_moduleName, this._chargingStation.getID(), "UnlockConnector", result);
					fulfill(result);
				}
			});
		});
	}

	reset(type) {
		// Get the Charging Station
		return new Promise((fulfill, reject) => {
			// Init SOAP Headers with the action
			this.initSoapHeaders("Reset");

			// Log
			Logging.logSendAction(_moduleName, this._chargingStation.getID(), "Reset", type);

			// Execute
			this._client.Reset({
				"resetRequest": {
					"type": type
				}
			}, (err, result, envelope) => {
				if(err) {
					// Log
					Logging.logError({
						source: this._chargingStation.getID(), module: "SoapChargingStationClient", method: "reset",
						message: `Error when trying to reboot: ${err.toString()}`,
						detailedMessages: [
							{ 'stack': err.stack },
							{ 'result': result }, 
							{ 'envelope': envelope } 
						]
					});
					reject(err);
				} else {
					// Log
					Logging.logReturnedAction(_moduleName, this._chargingStation.getID(), "Reset", result);
					fulfill(result);
				}
			});
		});
	}

	clearCache() {
		// Get the Charging Station
		return new Promise((fulfill, reject) => {
			// Init SOAP Headers with the action
			this.initSoapHeaders("ClearCache");

			// Log
			Logging.logSendAction(_moduleName, this._chargingStation.getID(), "ClearCache", {});

			// Execute
			this._client.ClearCache({clearCacheRequest: {}}, (err, result, envelope) => {
				if(err) {
					// Log
					Logging.logError({
						source: this._chargingStation.getID(), module: "SoapChargingStationClient", method: "clearCache",
						message: `Error when trying to clear the cache: ${err.toString()}`,
						detailedMessages: [
							{ 'stack': err.stack },
							{ 'result': result }, 
							{ 'envelope': envelope } 
						]
					});
					reject(err);
				} else {
					// Log
					Logging.logReturnedAction(_moduleName, this._chargingStation.getID(), "ClearCache", result);
					fulfill(result);
				}
			});
		});
	}

	getConfiguration(keys) {
		// Get the Charging Station
		return new Promise((fulfill, reject) => {
			// Init SOAP Headers with the action
			this.initSoapHeaders("GetConfiguration");

			// Log
			Logging.logSendAction(_moduleName, this._chargingStation.getID(), "GetConfiguration", keys);

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
			this._client.GetConfiguration(request, (err, result, envelope) => {
				if(err) {
					// Log
					Logging.logError({
						source: this._chargingStation.getID(), module: "SoapChargingStationClient", method: "getConfiguration",
						message: `Error when trying to get the configuration: ${err.toString()}`,
						detailedMessages: [
							{ 'stack': err.stack },
							{ 'result': result }, 
							{ 'envelope': envelope } 
						]
					});
					reject(err);
					//res.json(`{error: ${err.message}}`);
				} else {
					// Log
					Logging.logReturnedAction(_moduleName, this._chargingStation.getID(), "GetConfiguration", result);
					fulfill(result);
				}
			});
		});
	}

	changeConfiguration(key, value) {
		return new Promise((fulfill, reject) => {
			// Init SOAP Headers with the action
			this.initSoapHeaders("ChangeConfiguration");

			// Log
			Logging.logSendAction(_moduleName, this._chargingStation.getID(), "ChangeConfiguration", {"key": key, "value": value});

			// Execute
			this._client.ChangeConfiguration({
					"changeConfigurationRequest": {
						"key": key,
						"value": value
				}
			}, (err, result, envelope) => {
				if(err) {
					// Log
					Logging.logError({
						source: this._chargingStation.getID(), module: "SoapChargingStationClient", method: "changeConfiguration",
						message: `Error when trying to change the configuration parameter '${key}' with value '${value}': ${err.toString()}`,
						detailedMessages: [
							{ 'stack': err.stack },
							{ 'result': result }, 
							{ 'envelope': envelope } 
						]
					});
					reject(err);
				} else {
					// Log
					Logging.logReturnedAction(_moduleName, this._chargingStation.getID(), "ChangeConfiguration", result);
					fulfill(result);
				}
			});
		});
	}

	getChargingStation() {
		return this._chargingStation;
	}
}

module.exports = SoapChargingStationClient;
