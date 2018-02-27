const CentralRestServerAuthorization = require('./CentralRestServerAuthorization');
const Users = require('../../utils/Users');
const Utils = require('../../utils/Utils');
const sanitize = require('mongo-sanitize');

require('source-map-support').install();

class SecurityRestObjectFiltering {

	static filterResetPasswordRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.email = sanitize(request.email);
		filteredRequest.captcha = sanitize(request.captcha);
		filteredRequest.hash = sanitize(request.hash);
		return filteredRequest;
	}

	static filterEndUserLicenseAgreementRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.Language = sanitize(request.Language);
		return filteredRequest;
	}

	static filterTransactionDelete(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterTransactionSoftStop(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.transactionId = sanitize(request.transactionId);
		return filteredRequest;
	}

	static filterRegisterUserRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.name = sanitize(request.name);
		filteredRequest.firstName = sanitize(request.firstName);
		filteredRequest.email = sanitize(request.email);
		filteredRequest.password = sanitize(request.passwords.password);
		filteredRequest.captcha = sanitize(request.captcha);
		filteredRequest.status = Users.USER_STATUS_PENDING;
		return filteredRequest;
	}

	static filterLoginRequest(request) {
		let filteredRequest = {};
		// Set
		filteredRequest.email = sanitize(request.email);
		filteredRequest.password = sanitize(request.password);
		filteredRequest.acceptEula = sanitize(request.acceptEula);
		return filteredRequest;
	}

	static filterChargingStationDeleteRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterSiteDeleteRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterCompanyDeleteRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterSiteAreaDeleteRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterUserDeleteRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterPricingUpdateRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.priceKWH = sanitize(request.priceKWH);
		filteredRequest.priceUnit = sanitize(request.priceUnit);
		return filteredRequest;
	}

	static filterChargingStationConfigurationRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
		return filteredRequest;
	}

	static filterChargingStationConsumptionFromTransactionRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.TransactionId = sanitize(request.TransactionId);
		filteredRequest.StartDateTime = sanitize(request.StartDateTime);
		filteredRequest.EndDateTime = sanitize(request.EndDateTime);
		return filteredRequest;
	}

	static filterTransactionRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterChargingStationTransactionsRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
		filteredRequest.ConnectorId = sanitize(request.ConnectorId);
		filteredRequest.StartDateTime = sanitize(request.StartDateTime);
		filteredRequest.EndDateTime = sanitize(request.EndDateTime);
		return filteredRequest;
	}

	static filterBoolean(value) {
		let result = false;
		// Check boolean
		if(value) {
			// Sanitize
			value = sanitize(value);
			// Check the type
			if (typeof value == "boolean") {
				// Arealdy a boolean
				result = value;
			} else {
				// Convert
				result = (value === "true");
			}
		}
		return result;
	}

	static filterTransactionsActiveRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
		filteredRequest.ConnectorId = sanitize(request.ConnectorId);
		filteredRequest.WithPicture = SecurityRestObjectFiltering.filterBoolean(request.WithPicture);
		return filteredRequest;
	}

	static filterUserStatisticsRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.Year = sanitize(request.Year);
		filteredRequest.SiteID = sanitize(request.SiteID);
		return filteredRequest;
	}

	static filterChargingStationStatisticsRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.Year = sanitize(request.Year);
		filteredRequest.SiteID = sanitize(request.SiteID);
		return filteredRequest;
	}

	static filterTransactionsCompletedRequest(request, loggedUser) {
		let filteredRequest = {};
		// Handle picture
		filteredRequest.WithPicture = SecurityRestObjectFiltering.filterBoolean(request.WithPicture);
		filteredRequest.StartDateTime = sanitize(request.StartDateTime);
		filteredRequest.EndDateTime = sanitize(request.EndDateTime);
		filteredRequest.SiteID = sanitize(request.SiteID);
		filteredRequest.Search = sanitize(request.Search);
		if (request.UserID) {
			filteredRequest.UserID = sanitize(request.UserID);
		}
		SecurityRestObjectFiltering.filterLimit(request, filteredRequest);
		return filteredRequest;
	}

	static filterLimit(request, filteredRequest) {
		// Exist?
		if (!request.Limit) {
			// Default
			filteredRequest.Limit = 100;
		} else {
			// Parse
			filteredRequest.Limit = parseInt(sanitize(request.Limit));
			if (isNaN(filteredRequest.Limit)) {
				filteredRequest.Limit = 100;
			// Negative limit?
			} else if (filteredRequest.Limit < 0) {
				filteredRequest.Limit = 100;
			}
		}
	}

	static filterUserRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterUsersRequest(request, loggedUser) {
		let filteredRequest = {};
		// Handle picture
		filteredRequest.Search = request.Search;
		filteredRequest.WithPicture = SecurityRestObjectFiltering.filterBoolean(request.WithPicture);
		return filteredRequest;
	}

	static filterChargingStationRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterCompanyRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterSiteRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterSiteAreaRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterCompaniesRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.Search = sanitize(request.Search);
		filteredRequest.WithLogo = SecurityRestObjectFiltering.filterBoolean(request.WithLogo);
		filteredRequest.WithSites = SecurityRestObjectFiltering.filterBoolean(request.WithSites);
		return filteredRequest;
	}

	static filterSitesRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.Search = sanitize(request.Search);
		filteredRequest.WithPicture = SecurityRestObjectFiltering.filterBoolean(request.WithPicture);
		filteredRequest.WithSiteAreas = SecurityRestObjectFiltering.filterBoolean(request.WithSiteAreas);
		filteredRequest.WithChargeBoxes = SecurityRestObjectFiltering.filterBoolean(request.WithChargeBoxes);
		filteredRequest.WithCompanyLogo = SecurityRestObjectFiltering.filterBoolean(request.WithCompanyLogo);
		return filteredRequest;
	}

	static filterSiteAreasRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.Search = sanitize(request.Search);
		filteredRequest.WithPicture = SecurityRestObjectFiltering.filterBoolean(request.WithPicture);
		filteredRequest.WithChargeBoxes = SecurityRestObjectFiltering.filterBoolean(request.WithChargeBoxes);
		return filteredRequest;
	}

	static filterChargingStationsRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.Search = sanitize(request.Search);
		filteredRequest.OnlyWithNoSiteArea = SecurityRestObjectFiltering.filterBoolean(request.OnlyWithNoSiteArea);
		return filteredRequest;
	}

	static filterLoggingsRequest(request, loggedUser) {
		let filteredRequest = {};
		// Get logs
		filteredRequest.DateFrom = sanitize(request.DateFrom);
		filteredRequest.Level = sanitize(request.Level);
		filteredRequest.ChargingStation = sanitize(request.ChargingStation);
		filteredRequest.Search = sanitize(request.Search);
		filteredRequest.SortDate = sanitize(request.SortDate);
		filteredRequest.Type = sanitize(request.Type);
		SecurityRestObjectFiltering.filterLimit(request, filteredRequest);
		return filteredRequest;
	}

	static filterEndUserLicenseAgreementResponse(endUserLicenseAgreement, loggedUser) {
		let filteredEndUserLicenseAgreement = {};

		if (!endUserLicenseAgreement) {
			return null;
		}
		// Set
		filteredEndUserLicenseAgreement.text = endUserLicenseAgreement.text;
		return filteredEndUserLicenseAgreement;
	}

	static filterLoggingResponse(logging, loggedUser) {
		let filteredLogging = {};

		if (!logging) {
			return null;
		}
		filteredLogging.level = logging.level;
		filteredLogging.timestamp = logging.timestamp;
		filteredLogging.type = logging.type;
		filteredLogging.source = logging.source;
		filteredLogging.userFullName = logging.userFullName;
		filteredLogging.action = logging.action;
		filteredLogging.message = logging.message;
		filteredLogging.module = logging.module;
		filteredLogging.method = logging.method;
		filteredLogging.detailedMessages = logging.detailedMessages;
		return filteredLogging;
	}

	static filterLoggingsResponse(loggings, loggedUser) {
		let filteredLoggings = [];

		if (!loggings) {
			return null;
		}
		loggings.forEach(logging => {
			// Filter
			let filteredLogging = this.filterLoggingResponse(logging, loggedUser);
			// Ok?
			if (filteredLogging) {
				// Add
				filteredLoggings.push(filteredLogging);
			}
		});
		return filteredLoggings;
	}

	static filterUserUpdateRequest(request, loggedUser) {
		// Set
		let filteredRequest = SecurityRestObjectFiltering.filterUserCreateRequest(request, loggedUser);
		filteredRequest.id = sanitize(request.id);
		return filteredRequest;
	}

	static filterChargingStationUpdateRequest(request, loggedUser) {
		// Set
		let filteredRequest = {};
		filteredRequest.id = sanitize(request.id);
		filteredRequest.endpoint = sanitize(request.endpoint); // http://192.168.0.118:8080/
		filteredRequest.siteAreaID = sanitize(request.siteAreaID);
		return filteredRequest;
	}

	static filterCompanyUpdateRequest(request, loggedUser) {
		// Set
		let filteredRequest = SecurityRestObjectFiltering.filterCompanyCreateRequest(request, loggedUser);
		filteredRequest.id = sanitize(request.id);
		return filteredRequest;
	}

	static filterSiteUpdateRequest(request, loggedUser) {
		// Set
		let filteredRequest = SecurityRestObjectFiltering.filterSiteCreateRequest(request, loggedUser);
		filteredRequest.id = sanitize(request.id);
		return filteredRequest;
	}

	static filterSiteAreaUpdateRequest(request, loggedUser) {
		// Set
		let filteredRequest = SecurityRestObjectFiltering.filterSiteAreaCreateRequest(request, loggedUser);
		filteredRequest.id = sanitize(request.id);
		return filteredRequest;
	}

	static filterUserCreateRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.costCenter = sanitize(request.costCenter);
		filteredRequest.email = sanitize(request.email);
		filteredRequest.firstName = sanitize(request.firstName);
		filteredRequest.iNumber = sanitize(request.iNumber);
		filteredRequest.image = sanitize(request.image);
		filteredRequest.mobile = sanitize(request.mobile);
		filteredRequest.name = sanitize(request.name);
		filteredRequest.locale = sanitize(request.locale);
		filteredRequest.address = SecurityRestObjectFiltering.filterAddressRequest(request.address, loggedUser);
	if (request.passwords) {
			filteredRequest.password = sanitize(request.passwords.password);
		}
		filteredRequest.phone = sanitize(request.phone);
		// Admin?
		if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
			// Ok to set the role
			filteredRequest.role = sanitize(request.role);
			filteredRequest.status = sanitize(request.status);
		}
		filteredRequest.tagIDs = sanitize(request.tagIDs);
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

	static filterConsumptionsFromTransactionResponse(consumption, loggedUser) {
		let filteredConsumption = {};

		if (!consumption) {
			return null;
		}
		// Check
		if (CentralRestServerAuthorization.canReadChargingStation(loggedUser, consumption.chargeBoxID)) {
			filteredConsumption.chargeBoxID = consumption.chargeBoxID;
			filteredConsumption.connectorId = consumption.connectorId;
			// Admin?
			if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
				filteredConsumption.priceUnit = consumption.priceUnit;
				filteredConsumption.totalPrice = consumption.totalPrice;
			}
			filteredConsumption.totalConsumption = consumption.totalConsumption;
			filteredConsumption.transactionId = consumption.transactionId;
			// Check user
			if (consumption.user) {
				if (!CentralRestServerAuthorization.canReadUser(loggedUser, consumption.user)) {
					return null;
				}
			} else {
				if (!CentralRestServerAuthorization.isAdmin(loggedUser)) {
					return null;
				}
			}
			// Set user
			filteredConsumption.user = SecurityRestObjectFiltering.filterUserInTransactionResponse(
				consumption.user, loggedUser);
			// Admin?
			if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
				// Set them all
				filteredConsumption.values = consumption.values;
			} else {
				// Clean
				filteredConsumption.values = [];
				consumption.values.forEach((value) => {
					// Set
					filteredConsumption.values.push({
						date: value.date,
						value: value.value,
						cumulated: value.cumulated
					});
				});
			}
		}

		return filteredConsumption;
	}

	// Pricing
	static filterPricingResponse(pricing, loggedUser) {
		let filteredPricing = {};
		if (!pricing) {
			return null;
		}
		if (!CentralRestServerAuthorization.isAdmin(loggedUser)) {
			return null;
		}
		// Set
		filteredPricing.timestamp = pricing.timestamp;
		filteredPricing.priceKWH = pricing.priceKWH;
		filteredPricing.priceUnit = pricing.priceUnit;
		// Return
		return filteredPricing;
	}

	// User
	static filterUserResponse(user, loggedUser) {
		let filteredUser={};

		if (!user) {
			return null;
		}
		// Check auth
		if (CentralRestServerAuthorization.canReadUser(loggedUser, user)) {
			// Admin?
			if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
				filteredUser.id = user.id;
				filteredUser.name = user.name;
				filteredUser.firstName = user.firstName;
				filteredUser.locale = user.locale;
				filteredUser.email = user.email;
				filteredUser.phone = user.phone;
				filteredUser.mobile = user.mobile;
				filteredUser.iNumber = user.iNumber;
				filteredUser.costCenter = user.costCenter;
				filteredUser.status = user.status;
				filteredUser.eulaAcceptedOn = user.eulaAcceptedOn;
				filteredUser.eulaAcceptedVersion = user.eulaAcceptedVersion;
				filteredUser.createdBy = user.createdBy;
				filteredUser.createdOn = user.createdOn;
				filteredUser.lastChangedBy = user.lastChangedBy;
				filteredUser.lastChangedOn = user.lastChangedOn;
				filteredUser.tagIDs = user.tagIDs;
				filteredUser.role = user.role;
				filteredUser.numberOfTransactions = user.numberOfTransactions;
				if (user.image) {
					filteredUser.image = user.image;
				}
				if (user.address) {
					filteredUser.address = SecurityRestObjectFiltering.filterAddressRequest(user.address, loggedUser);
				}
			} else {
				// Set only necessary info
				filteredUser.id = user.id;
				filteredUser.name = user.name;
				filteredUser.firstName = user.firstName;
				filteredUser.email = user.email;
				filteredUser.locale = user.locale;
				if (user.image) {
					filteredUser.image = user.image;
				}
			}
		}

		return filteredUser;
	}

	static filterUsersResponse(users, loggedUser) {
		let filteredUsers = [];

		if (!users) {
			return null;
		}
		users.forEach(user => {
			// Filter
			let filteredUser = this.filterUserResponse(user, loggedUser);
			// Ok?
			if (filteredUser) {
				// Add
				filteredUsers.push(filteredUser);
			}
		});
		return filteredUsers;
	}

	// Charging Station
	static filterChargingStationResponse(chargingStation, loggedUser) {
		let filteredChargingStation;

		if (!chargingStation) {
			return null;
		}
		// Check auth
		if (CentralRestServerAuthorization.canReadChargingStation(loggedUser, chargingStation)) {
			// Admin?
			if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
				// Yes: set all params
				filteredChargingStation = chargingStation;
			} else {
				// Set only necessary info
				filteredChargingStation = {};
				filteredChargingStation.id = chargingStation.id;
				filteredChargingStation.chargeBoxID = chargingStation.chargeBoxID;
				filteredChargingStation.connectors = chargingStation.connectors;
				filteredChargingStation.lastHeartBeat = chargingStation.lastHeartBeat;
				filteredChargingStation.siteAreaID = chargingStation.siteAreaID;
				// Site Area
				if (chargingStation.siteArea) {
					filteredChargingStation.siteArea = this.filterSiteAreaResponse(chargingStation.siteArea, loggedUser);
				}
			}
		}
		return filteredChargingStation;
	}

	static filterSiteCreateRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.name = sanitize(request.name);
		filteredRequest.address = SecurityRestObjectFiltering.filterAddressRequest(request.address, loggedUser);
		filteredRequest.image = sanitize(request.image);
		filteredRequest.gps = sanitize(request.gps);
		filteredRequest.companyID = sanitize(request.companyID);
		return filteredRequest;
	}

	static filterAddressRequest(address, loggedUser) {
		let filteredAddress = {};
		if (address) {
			filteredAddress.address1 = sanitize(address.address1);
			filteredAddress.address2 = sanitize(address.address2);
			filteredAddress.postalCode = sanitize(address.postalCode);
			filteredAddress.city = sanitize(address.city);
			filteredAddress.department = sanitize(address.department);
			filteredAddress.region = sanitize(address.region);
			filteredAddress.country = sanitize(address.country);
			filteredAddress.latitude = sanitize(address.latitude);
			filteredAddress.longitude = sanitize(address.longitude);
		}
		return filteredAddress;
	}

	static filterCompanyCreateRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.name = sanitize(request.name);
		filteredRequest.address = SecurityRestObjectFiltering.filterAddressRequest(request.address, loggedUser);
		filteredRequest.logo = sanitize(request.logo);
		return filteredRequest;
	}

	static filterSiteAreaCreateRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.name = sanitize(request.name);
		filteredRequest.image = sanitize(request.image);
		filteredRequest.accessControl = SecurityRestObjectFiltering.filterBoolean(request.accessControl);
		filteredRequest.siteID = sanitize(request.siteID);
		filteredRequest.chargeBoxIDs = sanitize(request.chargeBoxIDs);
		return filteredRequest;
	}

	static filterCompanyResponse(company, loggedUser) {
		let filteredCompany;

		if (!company) {
			return null;
		}
		// Check auth
		if (CentralRestServerAuthorization.canReadCompany(loggedUser, company)) {
			// Admin?
			if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
				// Yes: set all params
				filteredCompany = company;
			} else {
				// Set only necessary info
				filteredCompany = {};
				filteredCompany.id = company.id;
				filteredCompany.name = company.name;
				filteredCompany.logo = company.logo;
			}
			if (company.address) {
				filteredCompany.address = SecurityRestObjectFiltering.filterAddressRequest(company.address, loggedUser);
			}
			if (company.sites) {
				filteredCompany.sites = company.sites.map((site) => {
					return SecurityRestObjectFiltering.filterSiteResponse(site, loggedUser);
				})
			}
			// Created By / Last Changed By
			SecurityRestObjectFiltering.filterCreatedByAndLastChangedBy(
				filteredCompany, company, loggedUser);
		}
		return filteredCompany;
	}

	static filterCreatedByAndLastChangedBy(filteredEntity, entity, loggedUser) {
		if (entity.createdBy && typeof entity.createdBy == "object" &&
				CentralRestServerAuthorization.canReadUser(loggedUser, entity.createdBy)) {
			// Build user
			filteredEntity.createdBy = Utils.buildUserFullName(entity.createdBy, false);
		}
		if (entity.lastChangedBy && typeof entity.lastChangedBy == "object" &&
				CentralRestServerAuthorization.canReadUser(loggedUser, entity.lastChangedBy)) {
			// Build user
			filteredEntity.lastChangedBy = Utils.buildUserFullName(entity.lastChangedBy, false);
		}
	}

	static filterSiteResponse(site, loggedUser) {
		let filteredSite;

		if (!site) {
			return null;
		}
		// Check auth
		if (CentralRestServerAuthorization.canReadSite(loggedUser, site)) {
			// Admin?
			if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
				// Yes: set all params
				filteredSite = site;
			} else {
				// Set only necessary info
				filteredSite = {};
				filteredSite.id = site.id;
				filteredSite.name = site.name;
				filteredSite.image = site.image;
				filteredSite.gps = site.gps;
				filteredSite.companyID = site.companyID;
			}
			if (site.address) {
				filteredSite.address = SecurityRestObjectFiltering.filterAddressRequest(site.address, loggedUser);
			}
			if (site.company) {
				filteredSite.company = this.filterCompanyResponse(site.company, loggedUser);;
			}
			if (site.siteAreas) {
				filteredSite.siteAreas = this.filterSiteAreasResponse(site.siteAreas, loggedUser);
			}
			// Created By / Last Changed By
			SecurityRestObjectFiltering.filterCreatedByAndLastChangedBy(
				filteredSite, site, loggedUser);
		}
		return filteredSite;
	}

	static filterSiteAreaResponse(siteArea, loggedUser) {
		let filteredSiteArea;

		if (!siteArea) {
			return null;
		}
		// Check auth
		if (CentralRestServerAuthorization.canReadSiteArea(loggedUser, siteArea)) {
			// Admin?
			if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
				// Yes: set all params
				filteredSiteArea = siteArea;
			} else {
				// Set only necessary info
				filteredSiteArea = {};
				filteredSiteArea.id = siteArea.id;
				filteredSiteArea.name = siteArea.name;
				filteredSiteArea.image = siteArea.image;
				filteredSiteArea.siteID = siteArea.siteID;
			}
			if (siteArea.site) {
				// Site
				filteredSiteArea.site = this.filterSiteResponse(siteArea.site, loggedUser);
			}
			if (siteArea.chargeBoxes) {
				filteredSiteArea.chargeBoxes = this.filterChargingStationsResponse(
					siteArea.chargeBoxes, loggedUser );
			}
			// Created By / Last Changed By
			SecurityRestObjectFiltering.filterCreatedByAndLastChangedBy(
				filteredSiteArea, siteArea, loggedUser);
		}
		return filteredSiteArea;
	}

	static filterChargingStationsResponse(chargingStations, loggedUser) {
		let filteredChargingStations = [];

		if (!chargingStations) {
			return null;
		}
		if (!CentralRestServerAuthorization.canListChargingStations(loggedUser)) {
			return null;
		}
		chargingStations.forEach(chargingStation => {
			// Filter
			let filteredChargingStation = this.filterChargingStationResponse(chargingStation, loggedUser);
			// Ok?
			if (filteredChargingStation) {
				// Add
				filteredChargingStations.push(filteredChargingStation);
			}
		});
		return filteredChargingStations;
	}

	static filterCompaniesResponse(companies, loggedUser) {
		let filteredCompanies = [];

		if (!companies) {
			return null;
		}
		if (!CentralRestServerAuthorization.canListCompanies(loggedUser)) {
			return null;
		}
		companies.forEach(company => {
			// Filter
			let filteredCompany = this.filterCompanyResponse(company, loggedUser);
			// Ok?
			if (filteredCompany) {
				// Add
				filteredCompanies.push(filteredCompany);
			}
		});
		return filteredCompanies;
	}

	static filterSitesResponse(sites, loggedUser) {
		let filteredSites = [];

		if (!sites) {
			return null;
		}
		if (!CentralRestServerAuthorization.canListSites(loggedUser)) {
			return null;
		}
		sites.forEach(site => {
			// Filter
			let filteredSite = this.filterSiteResponse(site, loggedUser);
			// Ok?
			if (filteredSite) {
				// Add
				filteredSites.push(filteredSite);
			}
		});
		return filteredSites;
	}

	static filterSiteAreasResponse(siteAreas, loggedUser) {
		let filteredSiteAreas = [];

		if (!siteAreas) {
			return null;
		}
		if (!CentralRestServerAuthorization.canListSiteAreas(loggedUser)) {
			return null;
		}
		siteAreas.forEach(siteArea => {
			// Filter
			let filteredSiteArea = this.filterSiteAreaResponse(siteArea, loggedUser);
			// Ok?
			if (filteredSiteArea) {
				// Add
				filteredSiteAreas.push(filteredSiteArea);
			}
		});
		return filteredSiteAreas;
	}

	// Transaction
	static filterTransactionResponse(transaction, loggedUser, withConnector=false) {
		let filteredTransaction;

		if (!transaction) {
			return null;
		}
		// Check auth
		if (CentralRestServerAuthorization.isAdmin(loggedUser) ||
			((transaction.user && CentralRestServerAuthorization.canReadUser(loggedUser, transaction.user)) &&
			CentralRestServerAuthorization.canReadChargingStation(loggedUser, transaction.chargeBox))) {
			// Set only necessary info
			filteredTransaction = {};
			filteredTransaction.id = transaction.id;
			filteredTransaction.transactionId = transaction.transactionId;
			filteredTransaction.connectorId = transaction.connectorId;
			filteredTransaction.timestamp = transaction.timestamp;
			// Filter user
			filteredTransaction.user = SecurityRestObjectFiltering.filterUserInTransactionResponse(
				transaction.user, loggedUser);
			// Transaction Stop
			if (transaction.stop) {
				filteredTransaction.stop = {};
				filteredTransaction.stop.timestamp = transaction.stop.timestamp;
				filteredTransaction.stop.totalConsumption = transaction.stop.totalConsumption;
				// Admin?
				if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
					filteredTransaction.stop.price = transaction.stop.price;
					filteredTransaction.stop.priceUnit = transaction.stop.priceUnit;
				}
				// Stop User
				if (transaction.stop.user) {
					// Filter user
					filteredTransaction.stop.user = SecurityRestObjectFiltering.filterUserInTransactionResponse(
						transaction.stop.user, loggedUser);
				}
			}
			// Charging Station
			filteredTransaction.chargeBox = {};
			filteredTransaction.chargeBox.id = transaction.chargeBox.id;
			filteredTransaction.chargeBox.chargeBoxID = transaction.chargeBox.chargeBoxID;
			if (withConnector) {
				filteredTransaction.chargeBox.connectors = [];
				filteredTransaction.chargeBox.connectors[transaction.connectorId-1] = transaction.chargeBox.connectors[transaction.connectorId-1];
			}
		}

		return filteredTransaction;
	}

	static filterUserInTransactionResponse(user, loggedUser) {
		let userID = {};

		if (!user) {
			return null;
		}
		// Check auth
		if (CentralRestServerAuthorization.canReadUser(loggedUser, user)) {
			// Demo user?
			if (CentralRestServerAuthorization.isDemo(loggedUser)) {
				userID.name = Users.ANONIMIZED_VALUE;
				userID.firstName = Users.ANONIMIZED_VALUE;
			} else {
				userID.name = user.name;
				userID.firstName = user.firstName;
				if (user.image) {
					userID.image = user.image;
				}
			}
		}
		return userID;
	}

	static filterTransactionsResponse(transactions, loggedUser, withConnector=false) {
		let filteredTransactions = [];

		if (!transactions) {
			return null;
		}
		if (!CentralRestServerAuthorization.canListTransactions(loggedUser)) {
			return null;
		}
		transactions.forEach(transaction => {
			// Filter
			let filteredTransaction = this.filterTransactionResponse(transaction, loggedUser, withConnector);
			// Ok?
			if (filteredTransaction) {
				// Add
				filteredTransactions.push(filteredTransaction);
			}
		});
		return filteredTransactions;
	}
}

module.exports = SecurityRestObjectFiltering;
