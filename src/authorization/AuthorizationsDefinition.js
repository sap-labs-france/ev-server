const Constants = require('../utils/Constants');
require('source-map-support').install();

class AuthorizationsDefinition {

	static getAuthorizations(role) {
		// Role
		switch (role) {
			// Admin
			case Constants.ROLE_ADMIN:
				return AuthorizationsDefinition.getAdminAuthorizations();
			// Basic
			case Constants.ROLE_BASIC:
				return AuthorizationsDefinition.getBasicAuthorizations();
			// Demo
			case Constants.ROLE_DEMO:
				return AuthorizationsDefinition.getDemoAuthorizations();
			// Default
			default:
				throw new Error(`Unknown Role '${role}'`);
		}
	}

	static getBasicAuthorizations() {
		return `
			{
				"id": "B",
				"name": "Basic",
				"auths": [
					{
						"AuthObject": "Users",
						"AuthFieldValue": {
							"Action": []
						}
					},
					{
						"AuthObject": "User",
						"AuthFieldValue": {
							"UserID": [
								{{#trim}}
									{{#userID}}
										"{{.}}",
									{{/userID}}
								{{/trim}}
							],
							"Action": ["Update","Read","Logout"]
						}
					},
					{
						"AuthObject": "Companies",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Company",
						"AuthFieldValue": {
							"CompanyID": [
								{{#trim}}
									{{#companyID}}
										"{{.}}",
									{{/companyID}}
								{{/trim}}
							],
							"Action": ["Read"]
						}
					},
					{
						"AuthObject": "Sites",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Site",
						"AuthFieldValue": {
							"SiteID": [
								{{#trim}}
									{{#siteID}}
										"{{.}}",
									{{/siteID}}
								{{/trim}}
							],
							"Action": ["Read"]
						}
					},
					{
						"AuthObject": "VehicleManufacturers",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "VehicleManufacturer",
						"AuthFieldValue": {
							"VehicleManufacturerID": "*",
							"Action": ["Read"]
						}
					},
					{
						"AuthObject": "Vehicles",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Vehicle",
						"AuthFieldValue": {
							"VehicleID": "*",
							"Action": ["Read"]
						}
					},
					{
						"AuthObject": "SiteAreas",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "SiteArea",
						"AuthFieldValue": {
							"SiteAreaID": "*",
							"Action": ["Read"]
						}
					},
					{
						"AuthObject": "ChargingStations",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "ChargingStation",
						"AuthFieldValue": {
							"ChargingStationID": "*",
							"Action": ["Read", "StartTransaction", "StopTransaction", "UnlockConnector", "Authorize"]
						}
					},
					{
						"AuthObject": "Transactions",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Transaction",
						"AuthFieldValue": {
							"UserID": [
								{{#trim}}
									{{#userID}}
										"{{.}}",
									{{/userID}}
								{{/trim}}
							],
							"Action": ["Read"]
						}
					},
					{
						"AuthObject": "Loggings",
						"AuthFieldValue": {
							"Action": []
						}
					},
					{
						"AuthObject": "Logging",
						"AuthFieldValue": {
							"LogID": "*",
							"Action": []
						}
					},
					{
						"AuthObject": "Pricing",
						"AuthFieldValue": {
							"Action": []
						}
					}
				]
			}
		`;
	}

	static getDemoAuthorizations() {
		return `
			{
				"id": "D",
				"name": "Demo",
				"auths": [
					{
						"AuthObject": "Users",
						"AuthFieldValue": {
							"Action": []
						}
					},
					{
						"AuthObject": "User",
						"AuthFieldValue": {
							"UserID": "*",
							"Action": ["Read", "Logout"]
						}
					},
					{
						"AuthObject": "Companies",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Company",
						"AuthFieldValue": {
							"CompanyID": "*",
							"Action": ["Read"]
						}
					},
					{
						"AuthObject": "Sites",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Site",
						"AuthFieldValue": {
							"SiteID": "*",
							"Action": ["Read"]
						}
					},
					{
						"AuthObject": "VehicleManufacturers",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "VehicleManufacturer",
						"AuthFieldValue": {
							"VehicleManufacturerID": "*",
							"Action": ["Read"]
						}
					},
					{
						"AuthObject": "Vehicles",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Vehicle",
						"AuthFieldValue": {
							"SiteID": "*",
							"Action": ["Read"]
						}
					},
					{
						"AuthObject": "SiteAreas",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "SiteArea",
						"AuthFieldValue": {
							"SiteAreaID": "*",
							"Action": ["Read"]
						}
					},
					{
						"AuthObject": "ChargingStations",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "ChargingStation",
						"AuthFieldValue": {
							"ChargingStationID": "*",
							"Action": ["Read"]
						}
					},
					{
						"AuthObject": "Transactions",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Transaction",
						"AuthFieldValue": {
							"UserID": "*",
							"Action": ["Read"]
						}
					},
					{
						"AuthObject": "Loggings",
						"AuthFieldValue": {
							"Action": []
						}
					},
					{
						"AuthObject": "Logging",
						"AuthFieldValue": {
							"LogID": "*",
							"Action": []
						}
					},
					{
						"AuthObject": "Pricing",
						"AuthFieldValue": {
							"Action": []
						}
					}
				]
			}
		`;
	}

	static getAdminAuthorizations() {
		return `
			{
				"id": "A",
				"name": "Admin",
				"auths": [
					{
						"AuthObject": "Users",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "User",
						"AuthFieldValue": {
							"UserID": "*",
							"Action": ["Create", "Read", "Update", "Delete", "Logout", "UnlockConnector"]
						}
					},
					{
						"AuthObject": "Companies",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Company",
						"AuthFieldValue": {
							"CompanyID": "*",
							"Action": ["Create", "Read", "Update", "Delete"]
						}
					},
					{
						"AuthObject": "Sites",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Site",
						"AuthFieldValue": {
							"SiteID": "*",
							"Action": ["Create", "Read", "Update", "Delete"]
						}
					},
					{
						"AuthObject": "VehicleManufacturers",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "VehicleManufacturer",
						"AuthFieldValue": {
							"VehicleManufacturerID": "*",
							"Action": ["Create", "Read", "Update", "Delete"]
						}
					},
					{
						"AuthObject": "Vehicles",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Vehicle",
						"AuthFieldValue": {
							"VehicleID": "*",
							"Action": ["Create", "Read", "Update", "Delete"]
						}
					},
					{
						"AuthObject": "SiteAreas",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "SiteArea",
						"AuthFieldValue": {
							"SiteAreaID": "*",
							"Action": ["Create", "Read", "Update", "Delete"]
						}
					},
					{
						"AuthObject": "ChargingStations",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "ChargingStation",
						"AuthFieldValue": {
							"ChargingStationID": "*",
							"Action": ["Create", "Read", "Update", "Delete", "Reset", "ClearCache", "GetConfiguration", "ChangeConfiguration", "StartTransaction", "StopTransaction", "UnlockConnector", "Authorize"]
						}
					},
					{
						"AuthObject": "Transactions",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Transaction",
						"AuthFieldValue": {
							"UserID": "*",
							"Action": ["Read", "Update", "Delete", "RefundTransaction"]
						}
					},
					{
						"AuthObject": "Loggings",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Logging",
						"AuthFieldValue": {
							"LogID": "*",
							"Action": ["Read"]
						}
					},
					{
						"AuthObject": "Pricing",
						"AuthFieldValue": {
							"Action": ["Read", "Update"]
						}
					}
				]
			}
		`;
	}
}

module.exports = AuthorizationsDefinition;
