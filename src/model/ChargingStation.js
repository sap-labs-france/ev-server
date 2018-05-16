const Utils = require('../utils/Utils');
const SoapChargingStationClient = require('../client/soap/SoapChargingStationClient');
const Logging = require('../utils/Logging');
const User = require('./User');
const SiteArea = require('./SiteArea');
const Users = require('../utils/Users');
const Sites = require('../utils/Sites');
const AppError = require('../exception/AppError');
const Constants = require('../utils/Constants');
const Database = require('../utils/Database');
const moment = require('moment');
const Configuration = require('../utils/Configuration');
const NotificationHandler = require('../notification/NotificationHandler');

_configAdvanced = Configuration.getAdvancedConfig();
_configChargingStation = Configuration.getChargingStationConfig();

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
				return this.requestStartTransaction(params.tagID);

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

	getSiteArea(withSite=false) {
		if (this._model.siteArea) {
			return Promise.resolve(new SiteArea(this._model.siteArea));
		} else if (this._model.siteAreaID){
			// Get from DB
			return global.storage.getSiteArea(this._model.siteAreaID, false, withSite).then((siteArea) => {
				// Keep it
				this.setSiteArea(siteArea);
				return siteArea;
			});
		} else {
			return Promise.resolve(null);
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

	getChargingStationClient() {
		// Already created?
		if (!this._chargingStationClient) {
			// Init client
			return new SoapChargingStationClient(this).then((soapClient) => {
				this._chargingStationClient = soapClient;
				return this._chargingStationClient;
			});
		} else {
			return Promise.resolve(this._chargingStationClient);
		}
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

	saveChargingStationURL() {
		// Save
		return global.storage.saveChargingStationURL(this.getModel());
	}

	saveChargingStationSiteArea() {
		// Save
		return global.storage.saveChargingStationSiteArea(this.getModel());
	}

	handleStatusNotification(statusNotification) {
		// Set the Station ID
		statusNotification.chargeBoxID = this.getID();

		// Update the connector -----------------------------------------
		// Get the connectors
		let connectors = this.getConnectors();

		// Init previous connector status
		for (var i = 0; i < statusNotification.connectorId; i++) {
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
		this.setConnectors(connectors);

		// Compute the power of the connector
		// Use a function to pass the connector`
		return ((connector) => {
			// Get the configuration
			return this.getConfiguration().then((configuration) => {
				var voltageRerefence = 0;
				var current = 0;
				var chargerConsumption = 0;
				var nbPhase = 0;

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

					// Compute it
					if (voltageRerefence && current && nbPhase) {
						// One Phase?
						if (nbPhase == 1) {
							connector.power = Math.floor(230 * current);
						} else {
							connector.power = Math.floor(400 * current * Math.sqrt(nbPhase));
						}
					}
				} else {
					// Not possible to compute Power
					connector.power = 0;
				}
				// Save Status Notif
				return global.storage.saveStatusNotification(statusNotification);
			}).then(() => {
				// Save Status
				return global.storage.saveChargingStationConnector(
					this.getModel(), statusNotification.connectorId);

			}).then(() => {
				// Check if error
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
							"error": `${statusNotification.status} - ${statusNotification.errorCode}`,
							"evseDashboardURL" : Utils.buildEvseURL(),
							"evseDashboardChargingStationURL" : Utils.buildEvseChargingStationURL(this, statusNotification.connectorId)
						}
					);
				}
			});
		})(connectors[statusNotification.connectorId-1]);
	}

	handleBootNotification(bootNotification) {
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
		return global.storage.saveBootNotification(bootNotification).then(() => {
			// Log
			Logging.logInfo({
				source: this.getID(),
				module: "ChargingStation", method: "handleBootNotification",
				action: "BootNotification", message: `Boot notification saved`
			});
			// Handle the get of configuration apart
			// In case of error. the boot should no be denied
			this.requestGetConfiguration().then((configuration) => {
				if (!configuration) {
					throw new AppError(
						this.getID(),
						`Cannot retrieve the configuration`,
						550, "ChargingStation", "handleBootNotification");
				}
				// Save it
				return this.saveConfiguration(configuration);
			}).then(() => {
				Logging.logInfo({
					source: this.getID(), module: "ChargingStation",
					method: "handleBootNotification", action: "BootNotification",
					message: `Configuration has been saved` });
			}).catch((error) => {
				// Log error
				Logging.logActionExceptionMessage("BootNotification", error);
			});
		});
	}

	updateChargingStationConsumption(transactionId) {
		// Get the last transaction first
		return this.getTransaction(transactionId).then((transaction) => {
			// Found?
			if (transaction) {
				// Get connectorId
				let connector = this.getConnectors()[transaction.connectorId-1];
				// Found?
				if (!transaction.stop) {
					// Get the consumption
					return this.getConsumptionsFromTransaction(transaction, false).then(
							(consumption) => {
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
							connector.currentConsumption = currentConsumption;
							connector.totalConsumption = totalConsumption;
							// Log
							Logging.logInfo({
								source: this.getID(), module: "ChargingStation",
								method: "updateChargingStationConsumption", action: "ChargingStationConsumption",
								message: `Connector '${connector.connectorId}' - Consumption changed to ${connector.currentConsumption}, Total: ${connector.totalConsumption}` });
						}
						this.setLastHeartBeat(new Date());
						// Handle End Of charge
						this.handleNotificationEndOfCharge(transaction, consumption);
						// Save
						return this.save();
					});
				} else {
					// Check
					if (connector.currentConsumption !== 0 || connector.totalConsumption !== 0) {
						// Set consumption
						connector.currentConsumption = 0;
						connector.totalConsumption = 0;
						// Log
						Logging.logInfo({
							source: this.getID(), module: "ChargingStation",
							method: "updateChargingStationConsumption", action: "ChargingStationConsumption",
							message: `Connector '${connector.connectorId}' - Consumption changed to ${connector.currentConsumption}, Total: ${connector.totalConsumption}` });
						// Save
						return this.save();
					}
				}
			} else {
				// Log
				Logging.logError({
					source: this.getID(), module: "ChargingStation",
					method: "updateChargingStationConsumption", action: "ChargingStationConsumption",
					message: `Transaction ID '${transactionId}' not found` });
			}
		});
	}

	handleNotificationEndOfCharge(transaction, consumption) {
		// Transaction in progress?
		if (transaction && !transaction.stop) {
			// Has consumption?
			if (consumption && consumption.values && consumption.values.length > 1) {
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
									(transaction.user.locale ? transaction.user.locale.replace('_','-') : Users.DEFAULT_LOCALE.replace('_','-')),
									{minimumIntegerDigits:1, minimumFractionDigits:0, maximumFractionDigits:2}),
								"totalDuration": this._buildCurrentTransactionDuration(transaction),
								"evseDashboardChargingStationURL" : Utils.buildEvseTransactionURL(this, transaction.connectorId, transaction.id),
								"evseDashboardURL" : Utils.buildEvseURL()
							},
							transaction.user.locale
						);
					}

					// Stop Transaction and Unlock Connector?
					if (_configChargingStation.notifStopTransactionAndUnlockConnector) {
						// Yes: Stop the transaction
						this.requestStopTransaction(transaction.id).then((result) => {
							// Ok?
							if (result && result.status === "Accepted") {
								// Cannot unlock the connector
								Logging.logInfo({
									source: this.getID(), module: "ChargingStation", method: "handleNotificationEndOfCharge",
									action: "NotifyEndOfCharge", message: `Transaction ID '${transaction.id}' has been stopped`,
									detailedMessages: transaction});
								// Unlock the connector
								this.requestUnlockConnector(transaction.connectorId).then((result) => {
									// Ok?
									if (result && result.status === "Accepted") {
										// Cannot unlock the connector
										Logging.logInfo({
											source: this.getID(), module: "ChargingStation", method: "handleNotificationEndOfCharge",
											action: "NotifyEndOfCharge", message: `Connector '${transaction.connectorId}' has been unlocked`,
											detailedMessages: transaction});
										// Nothing to do
										return Promise.resolve();
									} else {
										// Cannot unlock the connector
										Logging.logError({
											source: this.getID(), module: "ChargingStation", method: "handleNotificationEndOfCharge",
											action: "NotifyEndOfCharge", message: `Cannot unlock the connector '${transaction.connectorId}'`,
											detailedMessages: transaction});
									}
								}).catch((error) => {
									// Log error
									Logging.logActionExceptionMessage("EndOfCharge", error);
								});
							} else {
								// Cannot stop the transaction
								Logging.logError({
									source: this.getID(), module: "ChargingStation", method: "handleNotificationEndOfCharge",
									action: "NotifyEndOfCharge", message: `Cannot stop the transaction`,
									detailedMessages: transaction});
							}
						}).catch((error) => {
							// Log error
							Logging.logActionExceptionMessage("EndOfCharge", error);
						});
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
	_buildCurrentTransactionDuration(transaction, i18nHourShort="h") {
		// Build date
		let dateTimeString, timeDiffDuration;

		// Compute duration from now
		if (transaction.stop) {
			timeDiffDuration = moment.duration(
				moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))
			);
		} else {
			timeDiffDuration = moment.duration(
				moment().diff(moment(transaction.timestamp))
			);
		}
		// Set duration
		let mins = Math.floor(timeDiffDuration.minutes());
		// Set duration
		dateTimeString =
			Math.floor(timeDiffDuration.asHours()).toString() + i18nHourShort +
			(mins < 10 ? ("0" + mins) : mins.toString());
		// End
		return dateTimeString;
	}

	handleMeterValues(meterValues) {
		// Create model
		var newMeterValues = {};
		// Init
		newMeterValues.values = [];
		// Set the charger ID
		newMeterValues.chargeBoxID = this.getID();
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
		return global.storage.saveMeterValues(newMeterValues).then((result) => {
			// Update Charging Station Consumption
			return this.updateChargingStationConsumption(meterValues.transactionId);
		})
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

	delete() {
		// Check if the user has a transaction
		return this.hasAtLeastOneTransaction().then((result) => {
			if (result) {
				// Delete logically
				// Set deleted
				this.setDeleted(true);
				// Delete
				return this.save();
			} else {
				// Delete physically
				return global.storage.deleteChargingStation(this.getID());
			}
		})
	}

	handleStartTransaction(transaction) {
		// Set the charger ID
		transaction.chargeBoxID = this.getID();
		// Check if the charging station has already a transaction
		return this.getActiveTransaction(transaction.connectorId).then((activeTransaction) => {
			// Exists already?
			if (!activeTransaction) {
				// No: Generate the transaction ID
				transaction.id = Utils.getRandomInt();
			} else {
				// Yes: Reuse the transaction ID
				transaction.id = activeTransaction.id;
			}
			// Check user and save
			return this.checkIfUserIsAuthorized(transaction.idTag);
		}).then((user) => {
			if (user) {
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
			}
			// Set the tag ID
			transaction.tagID = transaction.idTag;
			// Ok: Save Transaction
			return global.storage.saveTransaction(transaction);
		});
	}

	getActiveTransaction(connectorId) {
		return global.storage.getActiveTransaction(this.getID(), connectorId);
	}

	handleDataTransfer(dataTransfer) {
		// Set the charger ID
		dataTransfer.chargeBoxID = this.getID();
		dataTransfer.timestamp = new Date();

		// Save it
		return global.storage.saveDataTransfer(dataTransfer);
	}

	handleDiagnosticsStatusNotification(diagnosticsStatusNotification) {
		// Set the charger ID
		diagnosticsStatusNotification.chargeBoxID = this.getID();
		diagnosticsStatusNotification.timestamp = new Date();

		// Save it
		return global.storage.saveDiagnosticsStatusNotification(diagnosticsStatusNotification);
	}

	handleFirmwareStatusNotification(firmwareStatusNotification) {
		// Set the charger ID
		firmwareStatusNotification.chargeBoxID = this.getID();
		firmwareStatusNotification.timestamp = new Date();

		// Save it
		return global.storage.saveFirmwareStatusNotification(firmwareStatusNotification);
	}

	handleAuthorize(authorize) {
		// Set the charger ID
		authorize.chargeBoxID = this.getID();
		authorize.timestamp = new Date();

		// Execute
		return this.checkIfUserIsAuthorized(authorize.idTag).then(() => {
			// Save
			return global.storage.saveAuthorize(authorize);
		})
	}

	getCompany() {
		// Get Site Area
		let site, siteArea;
		return this.getSiteArea().then((foundSiteArea) => {
			siteArea = foundSiteArea;
			// Site is mandatory
			if (!siteArea) {
				// Reject Site Not Found
				return Promise.reject( new AppError(
					this.getID(),
					`Charging Station '${this.getID()}' is not assigned to a Site Area!`, 500,
					"ChargingStation", "getCompany",
					null, null) );
			}
			// Get the Charge Box' Site
			return siteArea.getSite();
		}).then((foundSite) => {
			site = foundSite;
			if (!site) {
				// Reject Site Not Found
				return Promise.reject( new AppError(
					this.getID(),
					`Site Area '${siteArea.getName()}' is not assigned to a Site!`, 500,
					"ChargingStation", "getCompany",
					null, user.getModel()) );
			}
			// Get the Charge Box's Company
			return site.getCompany();
		}).then((company) => {
			if (!company) {
				// Reject Site Not Found
				return Promise.reject( new AppError(
					this.getID(),
					`Site '${site.getName()}' is not assigned to a Company!`, 500,
					"ChargingStation", "getCompany",
					null, user.getModel()) );
			}
			return company;
		});
	}

	checkIfUserIsAuthorized(tagID) {
		// Check first if the site area access control is active
		let user, site, siteArea, newUserCreated = false;
		// Site Area -----------------------------------------------
		return this.getSiteArea().then((foundSiteArea) => {
			siteArea = foundSiteArea;
			// Site is mandatory
			if (!siteArea) {
				// Reject Site Not Found
				return Promise.reject( new AppError(
					this.getID(),
					`Charging Station '${this.getID()}' is not assigned to a Site Area!`, 500,
					"ChargingStation", "checkIfUserIsAuthorized",
					null, null) );
			}
			// If Access Control is active: Check User with its Tag ID
			return global.storage.getUserByTagId(tagID);
		// User -----------------------------------------------
		}).then((foundUser) => {
			// Found?
			if (!foundUser) {
				// No: Create an empty user
				var newUser = new User({
					name: (siteArea.isAccessControlEnabled() ? "Unknown" : "Anonymous"),
					firstName: "User",
					status: (siteArea.isAccessControlEnabled() ? Users.USER_STATUS_PENDING : Users.USER_STATUS_ACTIVE),
					role: Users.USER_ROLE_BASIC,
					email: tagID + "@chargeangels.fr",
					tagIDs: [tagID],
					createdOn: new Date().toISOString()
				});
				// Set the flag
				newUserCreated = true;
				// Save the user
				return newUser.save();
			} else {
				return foundUser;
			}
		// User -----------------------------------------------
		}).then((foundUser) => {
			user = foundUser;
			// New User?
			if (newUserCreated) {
				// Notify
				NotificationHandler.sendUnknownUserBadged(
					Utils.generateGUID(),
					this.getModel(),
					{
						"chargingBoxID": this.getID(),
						"badgeId": tagID,
						"evseDashboardURL" : Utils.buildEvseURL(),
						"evseDashboardUserURL" : Utils.buildEvseUserURL(user)
					}
				);
			}
			// Access Control enabled?
			if (newUserCreated && siteArea.isAccessControlEnabled()) {
				// Yes
				return Promise.reject( new AppError(
					this.getID(),
					`User with Tag ID '${tagID}' not found but saved as inactive user`,
					"ChargingStation", "checkIfUserIsAuthorized",
					null, user.getModel()
				));
			}
			// Check User status
			if (user.getStatus() !== Users.USER_STATUS_ACTIVE) {
				// Reject but save ok
				return Promise.reject( new AppError(
					this.getID(),
					`User with TagID '${tagID}' is not Active`, 500,
					"ChargingStation", "checkIfUserIsAuthorized",
					null, user.getModel()) );
			}
			// Get the Charge Box' Site
			return siteArea.getSite(null, true);
		// Site -----------------------------------------------
		}).then((foundSite) => {
			site = foundSite;
			if (!site) {
				// Reject Site Not Found
				return Promise.reject( new AppError(
					this.getID(),
					`Site Area '${siteArea.getName()}' is not assigned to a Site!`, 500,
					"ChargingStation", "checkIfUserIsAuthorized",
					null, user.getModel()) );
			}
			// Get Users
			return site.getUsers();
		}).then((siteUsers) => {
			// Check if the user is assigned to the company
			let foundUser = siteUsers.find((siteUser) => {
				return siteUser.getID() == user.getID();
			});
			// User not found and Access Control Enabled?
			if (!foundUser && siteArea.isAccessControlEnabled()) {
				// Yes: Reject the User
				return Promise.reject( new AppError(
					this.getID(),
					`User is not assigned to the Site '${site.getName()}'!`, 500,
					"ChargingStation", "checkIfUserIsAuthorized",
					null, user.getModel()) );
			}
			// Return
			return user;
		});
	}

	getTransaction(transactionId) {
		// Get the tranasction first (to get the connector id)
		return global.storage.getTransaction(transactionId);
	}

	handleStopTransaction(stopTransaction) {
		let transaction, user;
		// Set the charger ID
		stopTransaction.chargeBoxID = this.getID();
		// Get the transaction first (to get the connector id)
		return this.getTransaction(stopTransaction.transactionId).then((foundTransaction) => {
			transaction = foundTransaction;
			// Found?
			if (!transaction) {
				throw new Error(`Transaction ID '${stopTransaction.transactionId}' does not exist`);
			}
			// Save it with the user
			if (stopTransaction.idTag) {
				// Set Tag ID
				stopTransaction.tagID = stopTransaction.idTag;
				// Check User
				return this.checkIfUserIsAuthorized(stopTransaction.idTag);
			}
		}).then((foundUser) => {
			user = foundUser;
			// User Found
			if (user) {
				// Set the User ID
				stopTransaction.userID = user.getID();
			}
			// Init the charging station
			this.getConnectors()[transaction.connectorId-1].currentConsumption = 0;
			this.getConnectors()[transaction.connectorId-1].totalConsumption = 0;
			// Save Charging Station
			return this.save();
		}).then(() => {
			// Compute total consumption (optimization)
			return this.getConsumptionsFromTransaction(transaction, true);
		}).then((consumption) => {
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
			// Notify User
			if (transaction.user) {
				// Send Notification
				NotificationHandler.sendEndOfSession(
					transaction.id + "-EOS",
					transaction.user,
					this.getModel(),
					{
						"user": transaction.user,
						"userStopped": user,
						"chargingBoxID": this.getID(),
						"connectorId": transaction.connectorId,
						"totalConsumption": (stopTransaction.totalConsumption/1000).toLocaleString(
							(transaction.user.locale ? transaction.user.locale.replace('_','-') : Users.DEFAULT_LOCALE.replace('_','-')),
							{minimumIntegerDigits:1, minimumFractionDigits:0, maximumFractionDigits:2}),
						"totalDuration": this._buildCurrentTransactionDuration(transaction),
						"totalInactivity": this._buildCurrentTransactionInactivity(transaction),
						"evseDashboardChargingStationURL" : Utils.buildEvseTransactionURL(this, transaction.connectorId, transaction.id),
						"evseDashboardURL" : Utils.buildEvseURL()
					},
					transaction.user.locale
				);
			}
			// Set the stop
			transaction.stop = stopTransaction;
			// // Save Transaction
			return global.storage.saveTransaction(transaction);
		});
	}

	// Restart the charger
	requestReset(type) {
		// Get the client
		return this.getChargingStationClient().then((chargingStationClient) => {
			// Restart
			return chargingStationClient.reset(type);
		});
	}

	// Stop Transaction
	requestStopTransaction(transactionId) {
		// Get the client
		return this.getChargingStationClient().then((chargingStationClient) => {
			// Restart
			return chargingStationClient.stopTransaction(transactionId);
		});
	}

	// Start Transaction
	requestStartTransaction(tagID) {
		// Get the client
		return this.getChargingStationClient().then((chargingStationClient) => {
			// Restart
			return chargingStationClient.startTransaction(tagID);
		});
	}

	// Clear the cache
	requestClearCache() {
		// Get the client
		return this.getChargingStationClient().then((chargingStationClient) => {
			// Restart
			return chargingStationClient.clearCache();
		});
	}

	// Get the configuration for the EVSE
	requestGetConfiguration(configParamNames) {
		// Get the client
		return this.getChargingStationClient().then((chargingStationClient) => {
			// Get config
			return chargingStationClient.getConfiguration(configParamNames);
		});
	}

	// Get the configuration for the EVSE
	requestChangeConfiguration(key, value) {
		// Get the client
		return this.getChargingStationClient().then((chargingStationClient) => {
			// Get config
			return chargingStationClient.changeConfiguration(key, value);
		// Result
		}).then((result) => {
			// Request the new Configuration?
			if (result.status === "Accepted") {
				// Get the Charging Station Config
				return this.requestGetConfiguration();
			} else {
				// Log
				return Promise.reject(new Error(`Cannot set the configuration param ${key} with value ${value} to ${this.getID()}`));
			}
		}).then((configuration) => {
			// Save it
			if (configuration) {
				// Save
				return this.saveConfiguration(configuration).then((config) => {
					// Ok ?
					if (config) {
						// Return the first result
						return {"status": "Accepted"};
					}
				});
			} else {
				// Log
				return Promise.reject(new Error(`Cannot retrieve the Configuration of ${this.getID()}`));
			}
		});
	}

	// Unlock connector
	requestUnlockConnector(connectorId) {
		// Get the client
		return this.getChargingStationClient().then((chargingStationClient) => {
			// Get config
			return chargingStationClient.unlockConnector(connectorId);
		});
	}

	getStatusNotifications(connectorId) {
		return global.storage.getStatusNotifications(this.getID(), connectorId).then((statusNotifications) => {
			return statusNotifications;
		});
	}

	getLastStatusNotification(connectorId) {
		return global.storage.getLastStatusNotification(this.getID(), connectorId).then((statusNotification) => {
			return statusNotification;
		});
	}

	getConfiguration() {
		return global.storage.getConfiguration(this.getID()).then((configuration) => {
			return configuration;
		});
	}

	getConfigurationParamValue(paramName) {
		return global.storage.getConfigurationParamValue(this.getID(), paramName).then((paramValue) => {
			return paramValue;
		});
	}

	hasAtLeastOneTransaction() {
		// Get the consumption
		return global.storage.getTransactions(
				null,
				{"chargeBoxID": this.getID()},
				null,
				1).then((transactions) => {
			return (transactions && transactions.length > 0 ? true : false);
		});;
	}

	getTransactions(connectorId, startDateTime, endDateTime) {
		// Get the consumption
		return global.storage.getTransactions(
			null,
			{"chargeBoxID": this.getID(),
			 "connectorId": connectorId,
			 "startDateTime": startDateTime,
			 "endDateTime" : endDateTime},
		 	Constants.NO_LIMIT);
	}

	getConsumptionsFromTransaction(transaction, optimizeNbrOfValues) {
		// Get the last 5 meter values
		return global.storage.getMeterValuesFromTransaction(
				transaction.id).then((meterValues) => {
			// Read the pricing
			return global.storage.getPricing().then((pricing) => {
				// Build the header
				var chargingStationConsumption = {};
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
				let consumptions = this.buildConsumption(chargingStationConsumption, meterValues, transaction, pricing, optimizeNbrOfValues);

				return consumptions;
			});
		});
	}

	getConsumptionsFromDateTimeRange(transaction, startDateTime) {
		// Get all from the transaction (not optimized)
		return this.getConsumptionsFromTransaction(transaction, false).then((consumptions) => {
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
		});
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
							// Debug
							//console.log(`Date: ${meterValue.timestamp.toISOString()}, Last Meter: ${lastMeterValue.value}, Meter: ${meterValue.value}, Conso: ${currentConsumption}, Cumulated: ${chargingStationConsumption.totalConsumption}`);
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
