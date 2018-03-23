const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Companies = require('../../../utils/Companies');
const Sites = require('../../../utils/Sites');
const SiteAreas = require('../../../utils/SiteAreas');
const Constants = require('../../../utils/Constants');
const Utils = require('../../../utils/Utils');
const Users = require('../../../utils/Users');
const Company = require('../../../model/Company');
const Site = require('../../../model/Site');
const SiteArea = require('../../../model/SiteArea');
const SiteAreaSecurity = require('./security/SiteAreaSecurity');

class SiteAreaService {
	static handleCreateSiteArea(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteAreaService",
			method: "handleCreateSiteArea",
			message: `Create Site Area '${req.body.name}'`,
			detailedMessages: req.body
		});
		// Check auth
		if (!CentralRestServerAuthorization.canCreateSite(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_CREATE,
				CentralRestServerAuthorization.ENTITY_SITE_AREA,
				null,
				560, "SiteAreaService", "handleCreateSiteArea",
				req.user);
		}
		// Filter
		let filteredRequest = SiteAreaSecurity.filterSiteAreaCreateRequest( req.body, req.user );
		let newSiteArea;
		let loggedUser;
		// Check Mandatory fields
		if (SiteAreas.checkIfSiteAreaValid("SiteAreaCreate", filteredRequest, req, res, next)) {
			// Check Site
			global.storage.getSite(filteredRequest.siteID).then((site) => {
				// Found?
				if (!site) {
					// Not Found!
					throw new AppError(
						Constants.CENTRAL_SERVER,
						`The Site ID '${filteredRequest.siteID}' does not exist`,
						550, "SiteAreaService", "handleCreateSiteArea");
				}
				// Get the logged user
				return global.storage.getUser(req.user.id);
			// Logged User
			}).then((foundLoggedUser) => {
				loggedUser = foundLoggedUser;
				// Create site
				let newSiteArea = new SiteArea(filteredRequest);
				// Update timestamp
				newSiteArea.setCreatedBy(loggedUser);
				newSiteArea.setCreatedOn(new Date());
				// Save
				return newSiteArea.save();
			}).then((createdSiteArea) => {
				newSiteArea = createdSiteArea;
				// Get the assigned Charge Boxes
				let proms = [];
				// Assign new Charging Stations
				filteredRequest.chargeBoxIDs.forEach((chargeBoxID) => {
					// Get it
					proms.push(global.storage.getChargingStation(chargeBoxID));
				});
				return Promise.all(proms);
			}).then((assignedChargingStations) => {
				let proms = [];
				// Get it
				assignedChargingStations.forEach((assignedChargingStation) => {
					// Update timestamp
					assignedChargingStation.setLastChangedBy(loggedUser);
					assignedChargingStation.setLastChangedOn(new Date());
					// Set
					assignedChargingStation.setSiteArea(newSiteArea);
					proms.push(assignedChargingStation.saveChargingStationSiteArea());
				});
				return Promise.all(proms);
			}).then((results) => {
				// Ok
				Logging.logSecurityInfo({
					user: req.user, module: "SiteAreaService", method: "handleCreateSiteArea",
					message: `Site Area '${newSiteArea.getName()}' has been created successfully`,
					action: action, detailedMessages: newSiteArea});
				// Ok
				res.json({status: `Success`});
				next();
			}).catch((err) => {
				// Log
				Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
			});
		}
	}

	static handleGetSiteAreas(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteAreaService",
			method: "handleGetSiteAreas",
			message: `Read All Site Areas`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListSiteAreas(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_SITE_AREAS,
				null,
				560, "SiteAreaService", "handleGetSiteAreas",
				req.user);
		}
		// Filter
		let filteredRequest = SiteAreaSecurity.filterSiteAreasRequest(req.query, req.user);
		// Get the sites
		global.storage.getSiteAreas(filteredRequest.Search,
				filteredRequest.WithChargeBoxes,
				Constants.NO_LIMIT).then((siteAreas) => {
			let siteAreasJSon = [];
			siteAreas.forEach((siteArea) => {
				// Set the model
				siteAreasJSon.push(siteArea.getModel());
			});
			// Return
			res.json(
				// Filter
				SiteAreaSecurity.filterSiteAreasResponse(
					siteAreasJSon, req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleDeleteSiteArea(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteAreaService",
			method: "handleDeleteSiteArea",
			message: `Delete Site Area '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let siteArea;
		let filteredRequest = SiteAreaSecurity.filterSiteAreaDeleteRequest(
			req.query, req.user);
		// Check Mandatory fields
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Site Area's ID must be provided`), req, res, next);
			return;
		}
		// Get
		global.storage.getSiteArea(filteredRequest.ID).then((foundSiteArea) => {
			siteArea = foundSiteArea;
			// Found?
			if (!siteArea) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Site Area with ID '${filteredRequest.ID}' does not exist`,
					550, "SiteAreaService", "handleDeleteSiteArea");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canDeleteSiteArea(req.user,
					{ "id": siteArea.getID() })) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_DELETE,
					CentralRestServerAuthorization.ENTITY_SITE_AREA,
					siteArea.getID(),
					560, "SiteAreaService", "handleDeleteSiteArea",
					req.user);
			}
			// Delete
			return siteArea.delete();
		}).then(() => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "SiteAreaService", method: "handleDeleteSiteArea",
				message: `Site Area '${siteArea.getName()}' has been deleted successfully`,
				action: action, detailedMessages: siteArea});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetSiteArea(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteAreaService",
			method: "handleGetSiteArea",
			message: `Read Site Area '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = SiteAreaSecurity.filterSiteAreaRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Site Area ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		global.storage.getSiteArea(filteredRequest.ID, SiteAreas.WITH_CHARGING_STATIONS,
				SiteAreas.WITHOUT_SITE).then((siteArea) => {
			// Found?
			if (!siteArea) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Site Area with ID '${filteredRequest.ID}' does not exist`,
					550, "SiteAreaService", "handleDeleteSiteArea");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadSiteArea(req.user, siteArea.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_READ,
					CentralRestServerAuthorization.ENTITY_SITE_AREA,
					siteArea.getID(),
					560, "SiteAreaService", "handleGetSiteAreaImage",
					req.user);
			}
			// Return
			res.json(
				// Filter
				SiteAreaSecurity.filterSiteAreaResponse(
					siteArea.getModel(), req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetSiteAreaImage(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteAreaService",
			method: "handleGetSiteAreaImage",
			message: `Read Site Area Image '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = SiteAreaSecurity.filterSiteAreaRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Site Area ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		global.storage.getSiteArea(filteredRequest.ID).then((siteArea) => {
			if (!siteArea) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Site Area with ID '${filteredRequest.ID}' does not exist anymore`,
					550, "SiteAreaService", "handleUpdateSiteArea");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadSiteArea(req.user, siteArea.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_READ,
					CentralRestServerAuthorization.ENTITY_SITE_AREA,
					siteArea.getID(),
					560, "SiteAreaService", "handleGetSiteAreaImage",
					req.user);
			}
			// Get the image
			return global.storage.getSiteAreaImage(filteredRequest.ID);
		}).then((siteAreaImage) => {
			// Found?
			if (siteAreaImage) {
				Logging.logSecurityInfo({
					user: req.user,
					action: action,
					module: "SiteAreaService", method: "handleGetSiteAreaImage",
					message: 'Read Site Area Image'
				});
				// Set the user
				res.json(siteAreaImage);
			} else {
				res.json(null);
			}
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetSiteAreaImages(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteAreaService", method: "handleGetSiteAreaImages",
			message: `Read Site Area Images`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListSiteAreas(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_SITE_AREAS,
				null,
				560, "SiteAreaService", "handleGetSiteAreaImages",
				req.user);
		}
		// Get the Site Area image
		global.storage.getSiteAreaImages().then((siteAreaImages) => {
			Logging.logSecurityInfo({
				user: req.user,
				action: action,
				module: "SiteAreaService", method: "handleGetSiteAreaImages",
				message: 'Read Site Area Images'
			});
			res.json(siteAreaImages);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleUpdateSiteArea(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteAreaService",
			method: "handleUpdateSiteArea",
			message: `Update Site Area '${req.body.name}' (ID '${req.body.id}')`,
			detailedMessages: req.body
		});
		// Filter
		let filteredRequest = SiteAreaSecurity.filterSiteAreaUpdateRequest( req.body, req.user );
		let siteArea;
		let loggedUser;
		// Check
		global.storage.getSiteArea(filteredRequest.id).then((foundSiteArea) => {
			siteArea = foundSiteArea;
			if (!siteArea) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Site Area with ID '${filteredRequest.id}' does not exist anymore`,
					550, "SiteAreaService", "handleUpdateSiteArea");
			}
			// Check Mandatory fields
			if (!SiteAreas.checkIfSiteAreaValid(action, filteredRequest, req, res, next)) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Site Area request in invalid`,
					500, "SiteAreaService", "handleUpdateSiteArea");
			};
			// Check auth
			if (!CentralRestServerAuthorization.canUpdateSiteArea(req.user, siteArea.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_UPDATE,
					CentralRestServerAuthorization.ENTITY_SITE_AREA,
					siteArea.getID(),
					560, "SiteAreaService", "handleUpdateSiteArea",
					req.user);
			}
			// Get the logged user
			return global.storage.getUser(req.user.id);
		// Logged User
		}).then((foundLoggedUser) => {
			loggedUser = foundLoggedUser;
			// Get Charging Stations
			return siteArea.getChargingStations();
		}).then((assignedChargingStations) => {
			let proms = [];
			// Clear Site Area from Existing Charging Station
			assignedChargingStations.forEach((assignedChargingStation) => {
				// Update timestamp
				assignedChargingStation.setLastChangedBy(loggedUser);
				assignedChargingStation.setLastChangedOn(new Date());
				// Set
				assignedChargingStation.setSiteArea(null);
				proms.push(assignedChargingStation.saveChargingStationSiteArea());
			});
			return Promise.all(proms);
		}).then((results) => {
			let proms = [];
			// Assign new Charging Stations
			filteredRequest.chargeBoxIDs.forEach((chargeBoxID) => {
				// Get it
				proms.push(global.storage.getChargingStation(chargeBoxID));
			});
			return Promise.all(proms);
		}).then((assignedChargingStations) => {
			let proms = [];
			// Get it
			assignedChargingStations.forEach((assignedChargingStation) => {
				// Update timestamp
				assignedChargingStation.setLastChangedBy(loggedUser);
				assignedChargingStation.setLastChangedOn(new Date());
				// Set
				assignedChargingStation.setSiteArea(siteArea);
				proms.push(assignedChargingStation.saveChargingStationSiteArea());
			});
			return Promise.all(proms);
		}).then((results) => {
			// Update
			Database.updateSiteArea(filteredRequest, siteArea.getModel());
			// Update timestamp
			siteArea.setLastChangedBy(loggedUser);
			siteArea.setLastChangedOn(new Date());
			// Update
			return siteArea.save();
		}).then((updatedSiteArea) => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "SiteAreaService", method: "handleUpdateSiteArea",
				message: `Site Area '${updatedSiteArea.getName()}' has been updated successfully`,
				action: action, detailedMessages: updatedSiteArea});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

module.exports = SiteAreaService;
