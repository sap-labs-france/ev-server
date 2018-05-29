const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../utils/Authorizations');
const Utils = require('../../../../utils/Utils');
const UtilsSecurity = require('./UtilsSecurity');
let SiteAreaSecurity; // Avoid circular deps

class ChargingStationSecurity {
	static getSiteAreaSecurity() {
		if (!SiteAreaSecurity) {
			SiteAreaSecurity = require('./SiteAreaSecurity');
		}
		return SiteAreaSecurity;
	}

	// Charging Station
	static filterChargingStationResponse(chargingStation, loggedUser) {
		let filteredChargingStation;

		if (!chargingStation) {
			return null;
		}
		// Check auth
		if (Authorizations.canReadChargingStation(loggedUser, chargingStation)) {
			// Admin?
			if (Authorizations.isAdmin(loggedUser)) {
				// Yes: set all params
				filteredChargingStation = chargingStation;
			} else {
				// Set only necessary info
				filteredChargingStation = {};
				filteredChargingStation.id = chargingStation.id;
				filteredChargingStation.chargeBoxID = chargingStation.chargeBoxID;
				filteredChargingStation.connectors = chargingStation.connectors;
				filteredChargingStation.lastHeartBeat = chargingStation.lastHeartBeat;
			}
			// Created By / Last Changed By
			UtilsSecurity.filterCreatedAndLastChanged(
				filteredChargingStation, chargingStation, loggedUser);
		}
		return filteredChargingStation;
	}

	static filterChargingStationsResponse(chargingStations, loggedUser) {
		let filteredChargingStations = [];

		if (!chargingStations) {
			return null;
		}
		if (!Authorizations.canListChargingStations(loggedUser)) {
			return null;
		}
		chargingStations.forEach(chargingStation => {
			// Filter
			let filteredChargingStation = ChargingStationSecurity.filterChargingStationResponse(chargingStation, loggedUser);
			// Ok?
			if (filteredChargingStation) {
				// Add
				filteredChargingStations.push(filteredChargingStation);
			}
		});
		return filteredChargingStations;
	}

	static filterChargingStationDeleteRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterChargingStationConfigurationRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
		return filteredRequest;
	}

	static filterChargingStationRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterChargingStationsRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.Search = sanitize(request.Search);
		filteredRequest.WithNoSiteArea = UtilsSecurity.filterBoolean(request.WithNoSiteArea);
		return filteredRequest;
	}

	static filterChargingStationParamsUpdateRequest(request, loggedUser) {
		// Set
		let filteredRequest = {};
		filteredRequest.id = sanitize(request.id);
		filteredRequest.chargingStationURL = sanitize(request.chargingStationURL);
		filteredRequest.numberOfConnectedPhase = sanitize(request.numberOfConnectedPhase);
		return filteredRequest;
	}

	static filterChargingStationActionRequest(request, action, loggedUser) {
		let filteredRequest = {};
		// Check
		filteredRequest.chargeBoxID = sanitize(request.chargeBoxID);
		// Do not check action?
		filteredRequest.args =  request.args;
		return filteredRequest;
	}

	static filterChargingStationSetMaxIntensitySocketRequest(request, loggedUser) {
		let filteredRequest = {};
		// Check
		filteredRequest.chargeBoxID = sanitize(request.chargeBoxID);
		filteredRequest.maxIntensity =  sanitize(request.args.maxIntensity);
		return filteredRequest;
	}
}

module.exports = ChargingStationSecurity;
