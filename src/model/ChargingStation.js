const Utils = require('../utils/Utils');
const SoapChargingStationClient = require('../client/soap/SoapChargingStationClient');
const Logging = require('../utils/Logging');
const User = require('./User');
const SiteArea = require('./SiteArea');
const Constants = require('../utils/Constants');
const Database = require('../utils/Database');
const moment = require('moment');
const Configuration = require('../utils/Configuration');
const NotificationHandler = require('../notification/NotificationHandler');
const Authorizations = require('../authorization/Authorizations');
const AppError = require('../exception/AppError');

let _configAdvanced = Configuration.getAdvancedConfig();
let _configChargingStation = Configuration.getChargingStationConfig();

class ChargingStation {
	constructor(chargingStation) {
		// Init model
		this._model = {};
		// Set it
		Database.updateChargingStation(chargingStation, this._model);
	}

	handleAction(action, params) {
		// Handle Client Requests
		switch (action) {
			// Reset
			case "Reset":
				return this.requestReset(params.type);

			// Clear cache
			case "ClearCache":
				return this.requestClearCache();

			// Get Configuration
			case "GetConfiguration":
				return this.requestGetConfiguration(params.keys);

			// Set Configuration
			case "ChangeConfiguration":
				// Change the config
				return this.requestChangeConfiguration(params.key, params.value);

			// Unlock Connector
			case "UnlockConnector":
				return this.requestUnlockConnector(params.connectorId);

			// Start Transaction
			case "StartTransaction":
				return this.requestStartTransaction(params.tagID, params.connectorID);

			// Stop Transaction
			case "StopTransaction":
				return this.requestStopTransaction(params.transactionId);

			// Not Exists!
			default:
				// Log
				Logging.logError({
					source: this.getID(), module: "ChargingStation", method: "handleAction",
					message: `Action does not exist: ${action}` });
				throw new Error(`Action does not exist: ${action}`);
		}
	}

	getID() {
		return this._model.id;
	}

	setSiteArea(siteArea) {
		if (siteArea) {
			this._model.siteArea = siteArea.getModel();
			this._model.siteAreaID = siteArea.getID();
		} else {
			this._model.siteArea = null;
		}
	}

	async getSiteArea(withSite=false) {
		if (this._model.siteArea) {
			return new SiteArea(this._model.siteArea);
		} else if (this._model.siteAreaID){
			// Get from DB
			let siteArea = await global.storage.getSiteArea(this._model.siteAreaID, false, withSite);
			// Set it
			this.setSiteArea(siteArea);
			// Return
			return siteArea;
		}
	}

	getChargePointVendor() {
		return this._model.chargePointVendor;
	}

	setChargePointVendor(chargePointVendor) {
		this._model.chargePointVendor = chargePointVendor;
	}

	getChargePointModel() {
		return this._model.chargePointModel;
	}

	setChargePointModel(chargePointModel) {
		this._model.chargePointModel = chargePointModel;
	}

	getChargePointSerialNumber() {
		return this._model.chargePointSerialNumber;
	}

	setChargePointSerialNumber(chargePointSerialNumber) {
		this._model.chargePointSerialNumber = chargePointSerialNumber;
	}

	getChargeBoxSerialNumber() {
		return this._model.chargeBoxSerialNumber;
	}

	setChargeBoxSerialNumber(chargeBoxSerialNumber) {
		this._model.chargeBoxSerialNumber = chargeBoxSerialNumber;
	}

	setInactive(inactive) {
		this._model.inactive = inactive;
	}

	isInactive() {
		return this._model.inactive;
	}

	getNumberOfConnectedPhase() {
		return this._model.numberOfConnectedPhase;
	}

	setNumberOfConnectedPhase(numberOfConnectedPhase) {
		this._model.numberOfConnectedPhase = numberOfConnectedPhase;
	}

	getFirmwareVersion() {
		return this._model.firmwareVersion;
	}

	setFirmwareVersion(firmwareVersion) {
		this._model.firmwareVersion = firmwareVersion;
	}

	getIccid() {
		return this._model.iccid;
	}

	setIccid(iccid) {
		this._model.iccid = iccid;
	}

	getImsi() {
		return this._model.imsi;
	}

	setImsi(imsi) {
		this._model.imsi = imsi;
	}

	getMeterType() {
		return this._model.meterType;
	}

	setMeterType(meterType) {
		this._model.meterType = meterType;
	}

	getMeterSerialNumber() {
		return this._model.meterSerialNumber;
	}

	setMeterSerialNumber(meterSerialNumber) {
		this._model.meterSerialNumber = meterSerialNumber;
	}

	getCreatedBy() {
		if (this._model.createdBy) {
			return new User(this._model.createdBy);
		}
		return null;
	}

	setCreatedBy(user) {
		this._model.createdBy = user.getModel();
	}

	getCreatedOn() {
		return this._model.createdOn;
	}

	setCreatedOn(createdOn) {
		this._model.createdOn = createdOn;
	}

	getLastChangedBy() {
		if (this._model.lastChangedBy) {
			return new User(this._model.lastChangedBy);
		}
		return null;
	}

	setLastChangedBy(user) {
		this._model.lastChangedBy = user.getModel();
	}

	getLastChangedOn() {
		return this._model.lastChangedOn;
	}

	setLastChangedOn(lastChangedOn) {
		this._model.lastChangedOn = lastChangedOn;
	}

	getEndPoint() {
		return this._model.endpoint;
	}

	setEndPoint(endpoint) {
		this._model.endpoint = endpoint;
	}

	getChargingStationURL() {
		return this._model.chargingStationURL;
	}

	setChargingStationURL(chargingStationURL) {
		this._model.chargingStationURL = chargingStationURL;
	}

	getOcppVersion() {
		return this._model.ocppVersion;
	}

	setOcppVersion(ocppVersion) {
		this._model.ocppVersion = ocppVersion;
	}

	async getChargingStationClient() {
		// Already created?
		if (!this._chargingStationClient) {
			// Init client
			this._chargingStationClient = await new SoapChargingStationClient(this);
		}
		return this._chargingStationClient;
	}

	getLastHeartBeat() {
		return this._model.lastHeartBeat;
	}

	setLastHeartBeat(lastHeartBeat) {
		this._model.lastHeartBeat = lastHeartBeat;
	}

	getConnectors() {
		return this._model.connectors;
	}

	setConnectors(connectors) {
		this._model.connectors = connectors;
	}

	getLastReboot() {
		return this._model.lastReboot;
	}

	setLastReboot(lastReboot) {
		this._model.lastReboot = lastReboot;
	}

	getModel() {
		return this._model;
	}

	static checkIfChargingStationValid(filteredRequest, request) {
		// Update mode?
		if(request.method !== 'POST' && !filteredRequest.id) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Charging Station ID is mandatory`, 500, 
				'ChargingStations', 'checkIfChargingStationValid');
		}
	}

	save() {
		// Init Connectors
		if (!this.getConnectors()) {
			this.setConnectors([]);
		}
		// Save
		return global.storage.saveChargingStation(this.getModel());
	}

	saveHeartBeat() {
		// Save
		return global.storage.saveChargingStationHeartBeat(this.getModel());
	}

	saveChargingStationSiteArea() {
		// Save
		return global.storage.saveChargingStationSiteArea(this.getModel());
	}

	async handleStatusNotification(statusNotification) {
		// Set the Station ID
		statusNotification.chargeBoxID = this.getID();
		if (!statusNotification.timestamp) {
			statusNotification.timestamp = new Date().toISOString();
		}
		// Update the connector -----------------------------------------
		// Get the connectors
		let connectors = this.getConnectors();
		// Init previous connector status
		for (let i = 0; i < statusNotification.connectorId; i++) {
			// Check if former connector can be set
			if (!connectors[i]) {
				// Init
				connectors[i] = { connectorId: i+1, currentConsumption: 0, status: 'Unknown', power: 0 };
			}
		}
		// Set the status
		connectors[statusNotification.connectorId-1].connectorId = statusNotification.connectorId;
		// Error Code?
		connectors[statusNotification.connectorId-1].status = statusNotification.status;
		connectors[statusNotification.connectorId-1].errorCode = statusNotification.errorCode;
		connectors[statusNotification.connectorId-1].info = statusNotification.info;
		connectors[statusNotification.connectorId-1].vendorErrorCode = statusNotification.vendorErrorCode;
		// Set
		this.setConnectors(connectors);
		// Update Power?
		if (!connectors[statusNotification.connectorId-1].power) {
			// Update
			this.updateConnectorsPower();
		}
		// Save Status Notif
		await global.storage.saveStatusNotification(statusNotification);
		// Save Charger Status
		await global.storage.saveChargingStationConnector(this.getModel(), statusNotification.connectorId);
		// Log
		Logging.logInfo({
			source: this.getID(), module: "ChargingStation", method: "handleStatusNotification",
			action: "StatusNotification", message: `'${statusNotification.status}-${statusNotification.errorCode}' on Connector '${statusNotification.connectorId}' has been saved` });
		// Notify if error
		if (statusNotification.status === "Faulted") {
			// Log
			Logging.logError({
				source: this.getID(), module: "ChargingStation",
				method: "handleStatusNotification", action: "StatusNotification",
				message: `Error on connector ${statusNotification.connectorId}: ${statusNotification.status} - ${statusNotification.errorCode}` });
			// Send Notification
			NotificationHandler.sendChargingStationStatusError(
				Utils.generateGUID(),
				this.getModel(),
				{
					"chargeBoxID": this.getID(),
					"connectorId": statusNotification.connectorId,
					"error": `${statusNotification.status} - ${statusNotification.errorCode} - ${statusNotification.errorInfo}`,
					"evseDashboardURL" : Utils.buildEvseURL(),
					"evseDashboardChargingStationURL" : Utils.buildEvseChargingStationURL(this, statusNotification.connectorId)
				}
			);
		}
	}

	async updateConnectorsPower() {
		let voltageRerefence = 0;
		let current = 0;
		let nbPhase = 0;
		let power = 0;

		// Get the configuration
		let configuration = await this.getConfiguration();
		// Config Provided?
		if (configuration && configuration.configuration) {
			// Search for params
			for (var i = 0; i < configuration.configuration.length; i++) {
				// Check
				switch (configuration.configuration[i].key) {
					// Voltage
					case "voltagererefence":
						// Get the meter interval
						voltageRerefence = parseInt(configuration.configuration[i].value);
						break;

					// Current
					case "currentpb1":
						// Get the meter interval
						current = parseInt(configuration.configuration[i].value);
						break;

					// Nb Phase
					case "nbphase":
						// Get the meter interval
						nbPhase = parseInt(configuration.configuration[i].value);
						break;
				}
			}
			// Override?
			if (this.getNumberOfConnectedPhase()) {
				// Yes
				nbPhase = this.getNumberOfConnectedPhase();
			}
			// Compute it
			if (voltageRerefence && current && nbPhase) {
				// One Phase?
				if (nbPhase == 1) {
					power = Math.floor(230 * current);
				} else {
					power = Math.floor(400 * current * Math.sqrt(nbPhase));
				}
			}
		}
		// Set Power
		this.getConnectors().forEach((connector) => {
			if (connector) {
				connector.power = power;
			}
		});
	}

	async handleBootNotification(bootNotification) {
		// Set the Station ID
		bootNotification.chargeBoxID = this.getID();
		// Send Notification
		NotificationHandler.sendChargingStationRegistered(
			Utils.generateGUID(),
			this.getModel(),
			{
				"chargeBoxID": this.getID(),
				"evseDashboardURL" : Utils.buildEvseURL(),
				"evseDashboardChargingStationURL" : Utils.buildEvseChargingStationURL(this)
			}
		);
		// Save Boot Notification
		await global.storage.saveBootNotification(bootNotification);
		// Log
		Logging.logInfo({
			source: this.getID(),
			module: "ChargingStation", method: "handleBootNotification",
			action: "BootNotification", message: `Boot notification saved`
		});
		// Handle the get of configuration later on
		setTimeout(() => {
			// Get config and save it
			this.requestAndSaveConfiguration();
		}, 3000);
	}

	async handleHeartBeat() {
		// Set Heartbeat
		this.setLastHeartBeat(new Date());
		// Save
		await this.saveHeartBeat();
		// Log
		Logging.logInfo({
			source: this.getID(),
			module: "ChargingStation", method: "handleHeartBeat",
			action: "Heartbeat", message: `Heartbeat saved`
		});
	}

	async requestAndSaveConfiguration() {
		let configuration = null;
		try {
			// In case of error. the boot should no be denied
			configuration = await this.requestGetConfiguration();
			// Log
			Logging.logInfo({
				source: this.getID(), module: "ChargingStation",
				method: "requestAndSaveConfiguration", action: "RequestConfiguration",
				message: `Command sent with success`,
				detailedMessages: configuration });
			// Override with Conf
			configuration = {
				'configuration': configuration.configurationKey
			}
		} catch (error) {
			// Log error
			Logging.logActionExceptionMessage("RequestConfiguration", error);
		}
		// Set default?
		if (!configuration) {
			// Check if there is an already existing config
			let existingConfiguration = await this.getConfiguration();
			if (!existingConfiguration) {
				// No config at all: Set default OCCP configuration
				configuration = {
					'configuration': [
						{ 'key': 'AllowOfflineTxForUnknownId', 'readonly': false, 'value': null }, 
						{ 'key': 'AuthorizationCacheEnabled', 'readonly': false, 'value': null }, 
						{ 'key': 'AuthorizeRemoteTxRequests', 'readonly': false, 'value': null }, 
						{ 'key': 'BlinkRepeat', 'readonly': false, 'value': null }, 
						{ 'key': 'ClockAlignedDataInterval', 'readonly': false, 'value': null }, 
						{ 'key': 'ConnectionTimeOut', 'readonly': false, 'value': null }, 
						{ 'key': 'GetConfigurationMaxKeys', 'readonly': false, 'value': null }, 
						{ 'key': 'HeartbeatInterval', 'readonly': false, 'value': null }, 
						{ 'key': 'LightIntensity', 'readonly': false, 'value': null }, 
						{ 'key': 'LocalAuthorizeOffline', 'readonly': false, 'value': null }, 
						{ 'key': 'LocalPreAuthorize', 'readonly': false, 'value': null }, 
						{ 'key': 'MaxEnergyOnInvalidId', 'readonly': false, 'value': null }, 
						{ 'key': 'MeterValuesAlignedData', 'readonly': false, 'value': null }, 
						{ 'key': 'MeterValuesAlignedDataMaxLength', 'readonly': false, 'value': null }, 
						{ 'key': 'MeterValuesSampledData', 'readonly': false, 'value': null }, 
						{ 'key': 'MeterValuesSampledDataMaxLength', 'readonly': false, 'value': null }, 
						{ 'key': 'MeterValueSampleInterval', 'readonly': false, 'value': null }, 
						{ 'key': 'MinimumStatusDuration', 'readonly': false, 'value': null }, 
						{ 'key': 'NumberOfConnectors', 'readonly': false, 'value': null }, 
						{ 'key': 'ResetRetries', 'readonly': false, 'value': null }, 
						{ 'key': 'ConnectorPhaseRotation', 'readonly': false, 'value': null }, 
						{ 'key': 'ConnectorPhaseRotationMaxLength', 'readonly': false, 'value': null }, 
						{ 'key': 'StopTransactionOnEVSideDisconnect', 'readonly': false, 'value': null }, 
						{ 'key': 'StopTransactionOnInvalidId', 'readonly': false, 'value': null }, 
						{ 'key': 'StopTxnAlignedData', 'readonly': false, 'value': null }, 
						{ 'key': 'StopTxnAlignedDataMaxLength', 'readonly': false, 'value': null }, 
						{ 'key': 'StopTxnSampledData', 'readonly': false, 'value': null }, 
						{ 'key': 'StopTxnSampledDataMaxLength', 'readonly': false, 'value': null }, 
						{ 'key': 'SupportedFeatureProfiles', 'readonly': false, 'value': null }, 
						{ 'key': 'SupportedFeatureProfilesMaxLength', 'readonly': false, 'value': null }, 
						{ 'key': 'TransactionMessageAttempts', 'readonly': false, 'value': null }, 
						{ 'key': 'TransactionMessageRetryInterval', 'readonly': false, 'value': null }, 
						{ 'key': 'UnlockConnectorOnEVSideDisconnect', 'readonly': false, 'value': null }, 
						{ 'key': 'WebSocketPingInterval', 'readonly': false, 'value': null }, 
						{ 'key': 'LocalAuthListEnabled', 'readonly': false, 'value': null }, 
						{ 'key': 'LocalAuthListMaxLength', 'readonly': false, 'value': null }, 
						{ 'key': 'SendLocalListMaxLength', 'readonly': false, 'value': null }, 
						{ 'key': 'ReserveConnectorZeroSupported', 'readonly': false, 'value': null }, 
						{ 'key': 'ChargeProfileMaxStackLevel', 'readonly': false, 'value': null }, 
						{ 'key': 'ChargingScheduleAllowedChargingRateUnit', 'readonly': false, 'value': null }, 
						{ 'key': 'ChargingScheduleMaxPeriods', 'readonly': false, 'value': null }, 
						{ 'key': 'ConnectorSwitch3to1PhaseSupported', 'readonly': false, 'value': null }, 
						{ 'key': 'MaxChargingProfilesInstalled', 'readonly': false, 'value': null }
					]
				};
			} else {
				// Set default
				configuration = existingConfiguration;
			}
		}
		// Save it
		await this.saveConfiguration(configuration);
		// Ok
		Logging.logInfo({
				source: this.getID(), module: "ChargingStation",
				method: "requestAndSaveConfiguration", action: "RequestConfiguration",
				message: `Configuration has been saved` });
		// Update connector power
		await this.updateConnectorsPower();
		// Ok
		return {status: 'Accepted'};
	}

	async updateChargingStationConsumption(transactionId) {
		// Get the last transaction first
		let transaction = await this.getTransaction(transactionId);
		// Found?
		if (transaction) {
			// Get connectorId
			let connector = this.getConnectors()[transaction.connectorId-1];
			// Found?
			if (!transaction.stop) {
				// Get the consumption
				let consumption = await this.getConsumptionsFromTransaction(transaction, false);
				let currentConsumption = 0;
				let totalConsumption = 0;
				// Check
				if (consumption) {
					currentConsumption = (consumption.values.length > 0?consumption.values[consumption.values.length-1].value:0);
					totalConsumption = consumption.totalConsumption;
				}
				// Changed?
				if (connector.currentConsumption !== currentConsumption ||
						connector.totalConsumption !== totalConsumption) {
					// Set consumption
					connector.currentConsumption = Math.floor(currentConsumption);
					connector.totalConsumption = Math.floor(totalConsumption);
					// Log
					Logging.logInfo({
						source: this.getID(), module: "ChargingStation",
						method: "updateChargingStationConsumption", action: "ChargingStationConsumption",
						message: `Connector '${connector.connectorId}' - Consumption changed to ${connector.currentConsumption}, Total: ${connector.totalConsumption}` });
				}
				// Update Transaction ID
				connector.activeTransactionID = transactionId;
				// Update Heartbeat
				this.setLastHeartBeat(new Date());
				// Handle End Of charge
				this.handleNotificationEndOfCharge(transaction, consumption);
				// Save
				await this.save();
			} else {
				// Set consumption
				connector.currentConsumption = 0;
				connector.totalConsumption = 0;
				// Reset Transaction ID
				connector.activeTransactionID = 0;
				// Log
				Logging.logInfo({
					source: this.getID(), module: "ChargingStation",
					method: "updateChargingStationConsumption", action: "ChargingStationConsumption",
					message: `Connector '${connector.connectorId}' - Consumption changed to ${connector.currentConsumption}, Total: ${connector.totalConsumption}` });
				// Save
				await this.save();
			}
		} else {
			// Log
			Logging.logError({
				source: this.getID(), module: "ChargingStation",
				method: "updateChargingStationConsumption", action: "ChargingStationConsumption",
				message: `Transaction ID '${transactionId}' not found` });
		}
	}

	async handleNotificationEndOfCharge(transaction, consumption) {
		// Transaction in progress?
		if (transaction && !transaction.stop) {
			// Has consumption?
			if (consumption && consumption.values && consumption.values.length > 1) {
				// Last timestamp
				let lastTimestamp = consumption.values[consumption.values.length-1].date;
				// Compute avg of last two values
				let avgConsumption = (consumption.values[consumption.values.length-1].value +
					consumption.values[consumption.values.length-2].value) / 2;
				// --------------------------------------------------------------------
				// Notification END of charge
				// --------------------------------------------------------------------
				if (_configChargingStation.notifEndOfChargeEnabled && avgConsumption === 0) {
					// Notify User?
					if (transaction.user) {
						// Send Notification
						NotificationHandler.sendEndOfCharge(
							transaction.id + "-EOC",
							transaction.user,
							this.getModel(),
							{
								"user": transaction.user,
								"chargingBoxID": this.getID(),
								"connectorId": transaction.connectorId,
								"totalConsumption": (this.getConnectors()[transaction.connectorId-1].totalConsumption/1000).toLocaleString(
									(transaction.user.locale ? transaction.user.locale.replace('_','-') : Constants.DEFAULT_LOCALE.replace('_','-')),
									{minimumIntegerDigits:1, minimumFractionDigits:0, maximumFractionDigits:2}),
								"totalDuration": this._buildCurrentTransactionDuration(transaction, lastTimestamp),
								"evseDashboardChargingStationURL" : Utils.buildEvseTransactionURL(this, transaction.connectorId, transaction.id),
								"evseDashboardURL" : Utils.buildEvseURL()
							},
							transaction.user.locale
						);
					}

					// Stop Transaction and Unlock Connector?
					if (_configChargingStation.notifStopTransactionAndUnlockConnector) {
						try {
							// Yes: Stop the transaction
							let result = await this.requestStopTransaction(transaction.id);
							// Ok?
							if (result && result.status === "Accepted") {
								// Cannot unlock the connector
								Logging.logInfo({
									source: this.getID(), module: "ChargingStation", method: "handleNotificationEndOfCharge",
									action: "NotifyEndOfCharge", message: `Transaction ID '${transaction.id}' has been stopped`,
									detailedMessages: transaction});
								// Unlock the connector
								result = await this.requestUnlockConnector(transaction.connectorId);
								// Ok?
								if (result && result.status === "Accepted") {
									// Cannot unlock the connector
									Logging.logInfo({
										source: this.getID(), module: "ChargingStation", method: "handleNotificationEndOfCharge",
										action: "NotifyEndOfCharge", message: `Connector '${transaction.connectorId}' has been unlocked`,
										detailedMessages: transaction});
								} else {
									// Cannot unlock the connector
									Logging.logError({
										source: this.getID(), module: "ChargingStation", method: "handleNotificationEndOfCharge",
										action: "NotifyEndOfCharge", message: `Cannot unlock the connector '${transaction.connectorId}'`,
										detailedMessages: transaction});
								}
							} else {
								// Cannot stop the transaction
								Logging.logError({
									source: this.getID(), module: "ChargingStation", method: "handleNotificationEndOfCharge",
									action: "NotifyEndOfCharge", message: `Cannot stop the transaction`,
									detailedMessages: transaction});
							}
						} catch(error) {
							// Log error
							Logging.logActionExceptionMessage("EndOfCharge", error);
						}
					}
				}
			}
		}
	}

	// Build Inactivity
	_buildCurrentTransactionInactivity(transaction, i18nHourShort="h") {
		// Check
		if (!transaction.stop || !transaction.stop.totalInactivitySecs) {
			return "0h00 (0%)";
		}
		// Compute duration from now
		let totalDurationSecs = moment.duration(
			moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds();
		// Compute the percentage
		let totalInactivityPercent = Math.round(
			parseInt(transaction.stop.totalInactivitySecs) * 100 / totalDurationSecs);
		// Create Moment
		let totalInactivitySecs = moment.duration(transaction.stop.totalInactivitySecs, 'seconds');
		// Get Minutes
		let mins = Math.floor(totalInactivitySecs.minutes());
		// Build Inactivity
		let inactivityString =
			Math.floor(totalInactivitySecs.asHours()).toString() + i18nHourShort +
			(mins < 10 ? ("0" + mins) : mins.toString()) +
			" (" + totalInactivityPercent + "%)";
		// End
		return inactivityString;
	}

	// Build duration
	_buildCurrentTransactionDuration(transaction, lastTimestamp) {
		// Build date
		let dateTimeString, timeDiffDuration;
		let i18nHourShort = "h";
		// Compute duration from now
		timeDiffDuration = moment.duration(
			moment(lastTimestamp).diff(moment(transaction.timestamp)));
		// Set duration
		let mins = Math.floor(timeDiffDuration.minutes());
		// Set duration
		dateTimeString =
			Math.floor(timeDiffDuration.asHours()).toString() + i18nHourShort +
			(mins < 10 ? ("0" + mins) : mins.toString());
		// End
		return dateTimeString;
	}

	async handleMeterValues(meterValues) {
		// Create model
		var newMeterValues = {};
		// Init
		newMeterValues.values = [];
		// Set the charger ID
		newMeterValues.chargeBoxID = this.getID();
		// Check if the transaction ID matches
		let chargerTransactionId = this.getConnectors()[meterValues.connectorId-1].activeTransactionID;
		// Same?
		if (parseInt(meterValues.transactionId) !== parseInt(chargerTransactionId)) {
			// No: Log
			Logging.logError({
				source: this.getID(), module: "ChargingStation", method: "handleMeterValues",
				action: "MeterValues", message: `Meter Values Transaction ID '${meterValues.transactionId}' has been overridden with Start Transaction ID '${chargerTransactionId}'`
			});
			// Override
			meterValues.transactionId = chargerTransactionId;
		} 
		// Check if OCPP 1.6
		if (meterValues.meterValue) {
			// Set it to 'values'
			meterValues.values = meterValues.meterValue;
		}
		// Only one value?
		if (!Array.isArray(meterValues.values)) {
			// Make it an array
			meterValues.values = [meterValues.values];
		}
		// For each value
		meterValues.values.forEach((value, index) => {
			var newMeterValue = {};
			// Set the ID
			newMeterValue.chargeBoxID = newMeterValues.chargeBoxID;
			newMeterValue.connectorId = meterValues.connectorId;
			if (meterValues.transactionId) {
				newMeterValue.transactionId = meterValues.transactionId;
			}
			newMeterValue.timestamp = value.timestamp;

			// Check OCPP 1.6
			if (value.sampledValue) {
				// Normalize
				value.value = value.sampledValue;
			}

			// Values provided?
			if (value.value) {
				// OCCP1.2: Set the values
				if(value.value.$value) {
					// Set
					newMeterValue.value = value.value.$value;
					newMeterValue.attribute = value.value.attributes;
				} else {
					newMeterValue.value = parseInt(value.value);
				}
			}
			// Add
			newMeterValues.values.push(newMeterValue);
		});
		// Save Meter Values
		await global.storage.saveMeterValues(newMeterValues);
		// Update Charging Station Consumption
		await this.updateChargingStationConsumption(meterValues.transactionId);
		// Log
		Logging.logInfo({
			source: this.getID(), module: "ChargingStation", method: "handleMeterValues",
			action: "MeterValues", message: `Meter Values have been saved for Transaction ID '${meterValues.transactionId}'`,
			detailedMessages: meterValues });
	}

	saveConfiguration(configuration) {
		// Set the charger ID
		configuration.chargeBoxID = this.getID();
		configuration.timestamp = new Date();

		// Save config
		return global.storage.saveConfiguration(configuration);
	}

	setDeleted(deleted) {
		this._model.deleted = deleted;
	}

	isDeleted() {
		return this._model.deleted;
	}

	deleteTransaction(transaction) {
		// Yes: save it
		return global.storage.deleteTransaction(transaction);
	}

	async delete() {
		// Check if the user has a transaction
		let result = await this.hasAtLeastOneTransaction();
		if (result) {
			// Delete logically
			// Set deleted
			this.setDeleted(true);
			// Delete
			await this.save();
		} else {
			// Delete physically
			await global.storage.deleteChargingStation(this.getID());
		}
	}

	getActiveTransaction(connectorId) {
		return global.storage.getActiveTransaction(this.getID(), connectorId);
	}

	async handleDataTransfer(dataTransfer) {
		// Set the charger ID
		dataTransfer.chargeBoxID = this.getID();
		dataTransfer.timestamp = new Date();
		// Save it
		await global.storage.saveDataTransfer(dataTransfer);
		// Log
		Logging.logInfo({
			source: this.getID(), module: "CharingStation", method: "handleDataTransfer",
			action: "DataTransfer", message: `Data Transfer has been saved` });
	}

	async handleDiagnosticsStatusNotification(diagnosticsStatusNotification) {
		// Set the charger ID
		diagnosticsStatusNotification.chargeBoxID = this.getID();
		diagnosticsStatusNotification.timestamp = new Date();
		// Save it
		await global.storage.saveDiagnosticsStatusNotification(diagnosticsStatusNotification);
		// Log
		Logging.logInfo({
			source: this.getID(), module: "ChargingStation", method: "handleDiagnosticsStatusNotification",
			action: "DiagnosticsStatusNotification", message: `Diagnostics Status Notification has been saved` });
	}

	async handleFirmwareStatusNotification(firmwareStatusNotification) {
		// Set the charger ID
		firmwareStatusNotification.chargeBoxID = this.getID();
		firmwareStatusNotification.timestamp = new Date();
		// Save it
		await global.storage.saveFirmwareStatusNotification(firmwareStatusNotification);
		// Log
		Logging.logInfo({
			source: this.getID(), module: "ChargingStation", method: "handleFirmwareStatusNotification",
			action: "FirmwareStatusNotification", message: `Firmware Status Notification has been saved` });
	}

	async handleAuthorize(authorize) {
		// Set the charger ID
		authorize.chargeBoxID = this.getID();
		authorize.timestamp = new Date();
		// Execute
		let users = await Authorizations.checkAndGetIfUserIsAuthorizedForChargingStation(
				Authorizations.ACTION_AUTHORIZE, this, authorize.idTag);
		// Set current user
		authorize.user = users.user;
		// Save
		await global.storage.saveAuthorize(authorize);
		// Log
		if (authorize.user) {
			// Log
			Logging.logInfo({
				source: this.getID(), module: "ChargingStation", method: "handleAuthorize",
				action: "Authorize", user: authorize.user.getModel(),
				message: `User has been authorized to use Charging Station` });
		} else {
			// Log
			Logging.logInfo({
				source: this.getID(), module: "ChargingStation", method: "handleAuthorize",
				action: "Authorize", message: `Anonymous user has been authorized to use the Charging Station` });
		}
	}

	async getSite() {
		// Get Site Area
		let siteArea = await this.getSiteArea();
		// Check Site Area
		if (!siteArea) {
			return null;
		}
		// Get Site
		let site = await siteArea.getSite();
		return site;
	}

	async getCompany() {
		// Get the Site
		let site = await this.getSite();
		// Check Site
		if (!site) {
			return null;
		}
		// Get the Company
		let company = await site.getCompany();
		return company;
	}

	getTransaction(transactionId) {
		// Get the tranasction first (to get the connector id)
		return global.storage.getTransaction(transactionId);
	}

	async handleStartTransaction(transaction) {
		// Set the charger ID
		transaction.chargeBoxID = this.getID();
		// Check user and save
		let users = await Authorizations.checkAndGetIfUserIsAuthorizedForChargingStation(
			Authorizations.ACTION_START_TRANSACTION, this, transaction.idTag);
		// Set current user
		let user = (users.alternateUser ? users.alternateUser : users.user);
		// Check for active transaction
		let activeTransaction;
		do {
			// Check if the charging station has already a transaction
			activeTransaction = await this.getActiveTransaction(transaction.connectorId);
			// Exists already?
			if (activeTransaction) {
				Logging.logInfo({
					source: this.getID(), module: "ChargingStation", method: "handleStartTransaction",
					action: "StartTransaction", user: user.getModel(), actionOnUser: activeTransaction.user,
					message: `Active Transaction ID '${activeTransaction.id}' has been deleted on Connector '${activeTransaction.connectorId}'` });
				// Delete
				await this.deleteTransaction(activeTransaction);
			}
		} while(activeTransaction);
		// Check transaction ID is not yet used
		let existingTransaction;
		do {
			// Generate new transaction ID
			transaction.id = Utils.getRandomInt();
			// Check if the charging station has already a transaction
			existingTransaction = await this.getTransaction(transaction.id);
			// Found?
			if (existingTransaction) {
				// Log
				Logging.logWarning({
					source: this.getID(), module: "ChargingStation", method: "handleStartTransaction",
					action: "StartTransaction", user: user.getModel(), 
					actionOnUser: existingTransaction.user,
					message: `Transaction ID '${transaction.id}' already exists, generating a new one...` });
			}
		} while(existingTransaction);
		// Set the user
		transaction.userID = user.getID();
		// Notify
		NotificationHandler.sendTransactionStarted(
			transaction.id,
			user.getModel(),
			this.getModel(),
			{
				"user": user.getModel(),
				"chargingBoxID": this.getID(),
				"connectorId": transaction.connectorId,
				"evseDashboardURL" : Utils.buildEvseURL(),
				"evseDashboardChargingStationURL" :
					Utils.buildEvseTransactionURL(this, transaction.connectorId, transaction.id)
			},
			user.getLocale()
		);
		// Set the tag ID
		transaction.tagID = transaction.idTag;
		// Ok: Save Transaction
		let newTransaction = await global.storage.saveTransaction(transaction);
		// Set the user
		newTransaction.user = user.getModel();
		// Update Consumption
		await this.updateChargingStationConsumption(transaction.id);
		// Log
		if (newTransaction.user) {
			Logging.logInfo({
				source: this.getID(), module: "ChargingStation", method: "handleStartTransaction",
				action: "StartTransaction", user: newTransaction.user,
				message: `Transaction ID '${newTransaction.id}' has been started on Connector '${newTransaction.connectorId}'` });
		} else {
			Logging.logInfo({
				source: this.getID(), module: "ChargingStation", method: "handleStartTransaction",
				action: "StartTransaction", message: `Transaction ID '${newTransaction.id}' has been started by an anonymous user on Connector '${newTransaction.connectorId}'` });
		}
		// Return
		return newTransaction;
	}

	async handleStopTransaction(stopTransaction) {
		// Set the charger ID
		stopTransaction.chargeBoxID = this.getID();
		// Get the transaction first (to get the connector id)
		let transaction = await this.getTransaction(stopTransaction.transactionId);
		// Found?
		if (!transaction) {
			throw new Error(`Transaction ID '${stopTransaction.transactionId}' does not exist`);
		}
		// Remote Stop Transaction?
		if (transaction.remotestop) {
			// Check Timestamp
			// Add the inactivity in secs
			let secs = moment.duration(moment().diff(
				moment(transaction.remotestop.timestamp))).asSeconds();
			// In a minute
			if (secs < 60) {
				// Set Tag ID with user that remotely stopped the transaction
				stopTransaction.idTag = transaction.remotestop.tagID;
			}
		}
		// Stop Transaction with the same user
		if (!stopTransaction.idTag) {
			// Set Tag ID with user that started the transaction
			stopTransaction.idTag = transaction.tagID;
		}
		// Set Tag ID to a new property
		stopTransaction.tagID = stopTransaction.idTag;
		// Check User
		let users = await Authorizations.checkAndGetIfUserIsAuthorizedForChargingStation(
			Authorizations.ACTION_STOP_TRANSACTION, this, transaction.tagID, stopTransaction.tagID);
		// Set current user
		let user = (users.alternateUser ? users.alternateUser : users.user);
		// Set the User ID
		stopTransaction.userID = user.getID();
		// Get the connector
		let connector = this.getConnectors()[transaction.connectorId-1];
		// Init the charging station
		connector.currentConsumption = 0;
		connector.totalConsumption = 0;
		// Reset Transaction ID
		connector.activeTransactionID = 0;
		// Save Charging Station
		await this.save();
		// Compute total consumption (optimization)
		let consumption = await this.getConsumptionsFromTransaction(transaction, true);
		// Compute total inactivity seconds
		stopTransaction.totalInactivitySecs = 0;
		consumption.values.forEach((value, index) => {
			// Don't check the first
			if (index > 0) {
				// Check value + Check Previous value
				if (value.value == 0 && consumption.values[index-1].value == 0) {
					// Add the inactivity in secs
					stopTransaction.totalInactivitySecs += moment.duration(
						moment(value.date).diff(moment(consumption.values[index-1].date))
					).asSeconds();
				}
			}
		});
		// Set the total consumption (optimization)
		stopTransaction.totalConsumption = consumption.totalConsumption;
		// Set the stop
		transaction.stop = stopTransaction;
		// Notify User
		if (transaction.user) {
			// Send Notification
			NotificationHandler.sendEndOfSession(
				transaction.id + "-EOS",
				transaction.user,
				this.getModel(),
				{
					"user": users.user.getModel(),
					"alternateUser": (users.user.getID() != users.alternateUser.getID() ? users.alternateUser.getModel() : null),
					"chargingBoxID": this.getID(),
					"connectorId": transaction.connectorId,
					"totalConsumption": (stopTransaction.totalConsumption/1000).toLocaleString(
						(transaction.user.locale ? transaction.user.locale.replace('_','-') : User.DEFAULT_LOCALE.replace('_','-')),
						{minimumIntegerDigits:1, minimumFractionDigits:0, maximumFractionDigits:2}),
					"totalDuration": this._buildCurrentTransactionDuration(transaction, transaction.stop.timestamp),
					"totalInactivity": this._buildCurrentTransactionInactivity(transaction),
					"evseDashboardChargingStationURL" : Utils.buildEvseTransactionURL(this, transaction.connectorId, transaction.id),
					"evseDashboardURL" : Utils.buildEvseURL()
				},
				transaction.user.locale
			);
		}
		// Save Transaction
		let newTransaction = await global.storage.saveTransaction(transaction);
		// Set the user
		newTransaction.user = users.user.getModel();
		newTransaction.stop.user = users.alternateUser.getModel();
		// Log
		Logging.logInfo({
			source: this.getID(), module: "ChargingStation", method: "handleStopTransaction",
			action: "StopTransaction", user: newTransaction.stop.user, actionOnUser: newTransaction.user,
			message: `Transaction ID '${newTransaction.id}' has been stopped` });
		// Return
		return newTransaction;
	}

	// Restart the charger
	async requestReset(type) {
		// Get the client
		let chargingStationClient = await this.getChargingStationClient();
		// Restart
		let result = await chargingStationClient.reset(type);
		// Log
		Logging.logInfo({
			source: this.getID(), module: "ChargingStation",
			method: "requestReset", action: "Reset",
			message: `Command sent with success`,
			detailedMessages: result });
		// Return
		return result;
	}

	// Stop Transaction
	async requestStopTransaction(transactionId) {
		// Get the client
		let chargingStationClient = await this.getChargingStationClient();
		// Stop Transaction
		let result = await chargingStationClient.stopTransaction(transactionId);
		// Log
		Logging.logInfo({
			source: this.getID(), module: "ChargingStation",
			method: "requestStopTransaction", action: "StopTransaction",
			message: `Command sent with success`,
			detailedMessages: result });
		// Return
		return result;
	}

	// Start Transaction
	async requestStartTransaction(tagID, connectorID) {
		// Get the client
		let chargingStationClient = await this.getChargingStationClient();
		// Start Transaction
		let result = await chargingStationClient.startTransaction(tagID, connectorID);
		// Log
		Logging.logInfo({
			source: this.getID(), module: "ChargingStation",
			method: "requestStartTransaction", action: "StartTransaction",
			message: `Command sent with success`,
			detailedMessages: result });
		// Return
		return result;
	}

	// Clear the cache
	async requestClearCache() {
		// Get the client
		let chargingStationClient = await this.getChargingStationClient();
		// Clear
		let result = await chargingStationClient.clearCache();
		// Log
		Logging.logInfo({
			source: this.getID(), module: "ChargingStation",
			method: "requestClearCache", action: "ClearCache",
			message: `Command sent with success`,
			detailedMessages: result });
		// Return
		return result;
	}

	// Get the configuration for the EVSE
	async requestGetConfiguration(configParamNames) {
		// Get the client
		let chargingStationClient = await this.getChargingStationClient();
		// Get config
		let result = await chargingStationClient.getConfiguration(configParamNames);
		// Log
		Logging.logInfo({
			source: this.getID(), module: "ChargingStation",
			method: "requestGetConfiguration", action: "GetConfiguration",
			message: `Command sent with success`,
			detailedMessages: result });
		// Return
		return result;
	}

	// Get the configuration for the EVSE
	async requestChangeConfiguration(key, value) {
		// Get the client
		let chargingStationClient = await this.getChargingStationClient();
		// Get config
		let result = await chargingStationClient.changeConfiguration(key, value);
		// Log
		Logging.logInfo({
			source: this.getID(), module: "ChargingStation",
			method: "requestChangeConfiguration", action: "ChangeConfiguration",
			message: `Command sent with success`,
			detailedMessages: result });
		// Request the new Configuration?
		if (result.status !== "Accepted") {
			// Log
			throw new Error(`Cannot set the configuration param ${key} with value ${value} to ${this.getID()}`);
		}
		// Update
		await this.requestAndSaveConfiguration();
		// Return
		return result;
	}

	// Unlock connector
	async requestUnlockConnector(connectorId) {
		// Get the client
		let chargingStationClient = await this.getChargingStationClient();
		// Get config
		let result = await chargingStationClient.unlockConnector(connectorId);
		// Log
		Logging.logInfo({
			source: this.getID(), module: "ChargingStation",
			method: "requestUnlockConnector", action: "UnlockConnector",
			message: `Command sent with success`,
			detailedMessages: result });
		// Return
		return result;
	}

	getConfiguration() {
		return global.storage.getConfiguration(this.getID());
	}

	getConfigurationParamValue(paramName) {
		return global.storage.getConfigurationParamValue(this.getID(), paramName);
	}

	async hasAtLeastOneTransaction() {
		// Get the consumption
		let transactions = await global.storage.getTransactions(
				null, {"chargeBoxID": this.getID()}, null, false, 1);
		// Return
		return (transactions && transactions.length > 0 ? true : false);
	}

	getTransactions(connectorId, startDateTime, endDateTime, withChargeBoxes=false) {
		// Get the consumption
		return global.storage.getTransactions(
			null,
			{"chargeBoxID": this.getID(),
			 "connectorId": connectorId,
			 "startDateTime": startDateTime,
			 "endDateTime" : endDateTime},
			null,
			withChargeBoxes,
		 	Constants.NO_LIMIT);
	}

	async getConsumptionsFromTransaction(transaction, optimizeNbrOfValues) {
		// Get the last 5 meter values
		let meterValues = await global.storage.getMeterValuesFromTransaction(transaction.id);
		// Read the pricing
		let pricing = await global.storage.getPricing();
		// Build the header
		let chargingStationConsumption = {};
		if (pricing) {
			chargingStationConsumption.priceUnit = pricing.priceUnit;
			chargingStationConsumption.totalPrice = 0;
		}
		chargingStationConsumption.values = [];
		chargingStationConsumption.totalConsumption = 0;
		chargingStationConsumption.chargeBoxID = this.getID();
		chargingStationConsumption.connectorId = transaction.connectorId;
		chargingStationConsumption.transactionId = transaction.id;
		chargingStationConsumption.user = transaction.user;
		if (transaction.stop && transaction.stop.user) {
			chargingStationConsumption.stop = {};
			chargingStationConsumption.stop.user = transaction.stop.user;
		}
		// Compute consumption
		return this.buildConsumption(chargingStationConsumption, meterValues, transaction, pricing, optimizeNbrOfValues);
	}

	async getConsumptionsFromDateTimeRange(transaction, startDateTime) {
		// Get all from the transaction (not optimized)
		let consumptions = await this.getConsumptionsFromTransaction(transaction, false);
		// Found?
		if (consumptions && consumptions.values) {
			// Start date
			let startDateMoment = moment(startDateTime);
			// Filter value per date
			consumptions.values = consumptions.values.filter((consumption) => {
				// Filter
				return moment(consumption.date).isAfter(startDateMoment);
			});
		}
		return consumptions;
	}

	// Method to build the consumption
	buildConsumption(chargingStationConsumption, meterValues, transaction, pricing, optimizeNbrOfValues) {
		// Init
		let totalNbrOfMetrics = 0;
		let lastMeterValue;
		let firstMeterValueSet = false;
		// Set first value from transaction
		if (meterValues && meterValues.length > 0 && transaction) {
			// Set last meter value
			let meterValueFromTransactionStart = {
				id: '666',
				connectorId: transaction.connectorId,
				transactionId: transaction.transactionId,
				timestamp: transaction.timestamp,
				value: transaction.meterStart,
				attribute: {
					unit: 'Wh',
					location: 'Outlet',
					measurand: 'Energy.Active.Import.Register',
					format: 'Raw',
					context: 'Sample.Periodic'
				}
			};
			// Append
			meterValues.splice(0, 0, meterValueFromTransactionStart);

			// Set last value from transaction
			if (transaction.stop) {
				// Set last meter value
				let meterValueFromTransactionStop = {
					id: '6969',
					connectorId: transaction.connectorId,
					transactionId: transaction.transactionId,
					timestamp: transaction.stop.timestamp,
					value: transaction.stop.meterStop,
					attribute: {
						unit: 'Wh',
						location: 'Outlet',
						measurand: 'Energy.Active.Import.Register',
						format: 'Raw',
						context: 'Sample.Periodic'
					}
				};
				// Append
				meterValues.push(meterValueFromTransactionStop);
			}
		}
		// Build the model
		meterValues.forEach((meterValue, meterValueIndex) => {
			// Get the stored values
			let numberOfReturnedMeters = chargingStationConsumption.values.length;

			// Filter on consumption value
			if (meterValue.attribute && meterValue.attribute.measurand &&
					meterValue.attribute.measurand === "Energy.Active.Import.Register") {
				// Get the moment
				let currentTimestamp = moment(meterValue.timestamp);
				// First value?
				if (!firstMeterValueSet) {
					// No: Keep the first value
					lastMeterValue = meterValue;
					// Ok
					firstMeterValueSet = true;
				// Calculate the consumption with the last value provided
				} else {
					// Value provided?
					if (meterValue.value > 0 || lastMeterValue.value > 0) {
						// Last value is > ?
						if (lastMeterValue.value > meterValue.value) {
							// Yes: reinit it (the value has started over from 0)
							lastMeterValue.value = 0;
						}
						// Get the moment
						let currentTimestamp = moment(meterValue.timestamp);
						// Check if it will be added
						let addValue = false;
						// Start to return the value after the requested date
						if (!chargingStationConsumption.startDateTime ||
								currentTimestamp.isAfter(chargingStationConsumption.startDateTime) ) {
							// Set default
							addValue = true;
							// Count
							totalNbrOfMetrics++;
							// Get the diff
							var diffSecs = currentTimestamp.diff(lastMeterValue.timestamp, "seconds");
							// Sample multiplier
							let sampleMultiplier = 3600 / diffSecs;
							// compute
							let currentConsumption = (meterValue.value - lastMeterValue.value) * sampleMultiplier;
							// At least one value returned
							if (numberOfReturnedMeters > 0) {
								// Consumption?
								if (currentConsumption > 0) {
									// 0..123 -> Current value is positive and n-1 is 0: add 0 before the end graph is drawn
									if (chargingStationConsumption.values[numberOfReturnedMeters-1].value === 0) {
										// Check the timeframe: should be just before: if not add one
										if (currentTimestamp.diff(chargingStationConsumption.values[numberOfReturnedMeters-1].date, "seconds") > diffSecs) {
											// Add a 0 just before
											chargingStationConsumption.values.push({date: currentTimestamp.clone().subtract(diffSecs, "seconds").toDate(), value: 0 });
										}
									// Return one value every 'n' time intervals
									} else if (optimizeNbrOfValues && currentTimestamp.diff(chargingStationConsumption.values[numberOfReturnedMeters-1].date, "seconds") < _configAdvanced.chargeCurveTimeFrameSecsPoint) {
										// Do not add
										addValue = false;
									}
								} else {
									// Check if last but one consumption was 0 and not the last meter value
									if (optimizeNbrOfValues && (chargingStationConsumption.values[numberOfReturnedMeters-1].value === 0) &&
											(meterValueIndex !== meterValues.length-1)) {
										// Do not add
										addValue = false;
									}
								}
							}
							// Counting
							let consumptionWh = meterValue.value - lastMeterValue.value;
							chargingStationConsumption.totalConsumption += consumptionWh;
							// Compute the price
							if (pricing) {
								chargingStationConsumption.totalPrice += (consumptionWh/1000) * pricing.priceKWH;
							}
							// Add it?
							if (addValue) {
								// Create
								let consumption = {
									date: meterValue.timestamp,
									value: currentConsumption,
									cumulated: chargingStationConsumption.totalConsumption };
								// Compute the price
								if (pricing) {
									// Set the consumption with price
									consumption.price = (consumptionWh/1000) * pricing.priceKWH;
								}
								// Set the consumption
								chargingStationConsumption.values.push(consumption);
							}
						}
					} else {
						// Last one is 0, set it to 0
						if (!optimizeNbrOfValues || meterValueIndex === meterValues.length-1) {
							// Add a 0 just before
							chargingStationConsumption.values.push({date: currentTimestamp.toDate(), value: 0 });
						}
					}
					// Set Last Value
					lastMeterValue = meterValue;
				}
			}
		});
		if (totalNbrOfMetrics) {
			// Log
			Logging.logDebug({
				source: this.getID(), module: "ChargingStation",
				method: "buildConsumption", action:"BuildConsumption",
				message: `Consumption - ${meterValues.length} metrics, ${totalNbrOfMetrics} relevant, ${chargingStationConsumption.values.length} returned` });
		}
		// Return the result
		return chargingStationConsumption;
	}
}

module.exports = ChargingStation;
