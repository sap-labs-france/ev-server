const Constants = require('../utils/Constants');
require('source-map-support').install();

class AuthorizationsDefinition {

  static getAuthorizations(role) {
    // Role
    switch (role) {
      // Super Admin
      case Constants.ROLE_SUPER_ADMIN:
        return AuthorizationsDefinition.getSuperAdminAuthorizations();
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
							"Action": ["Read", "RemoteStartTransaction", "RemoteStopTransaction", "UnlockConnector", "Authorize"]
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
							"Action": ["Read","RefundTransaction"]
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
					}, {
						"AuthObject": "Tenants",
						"AuthFieldValue": {
							"Action": []
						}
					}, {
						"AuthObject": "Tenant",
						"AuthFieldValue": {
							"TenantID": "*",
							"Action": []
						}
					},
					{
						"AuthObject": "Settings",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Setting",
						"AuthFieldValue": {
							"SettingID": "*",
							"Action": ["Read"]
						}
					},
					{
						"AuthObject": "OcpiEndpoints",
						"AuthFieldValue": {
							"Action": []
						}
					},
					{
						"AuthObject": "OcpiEndpoint",
						"AuthFieldValue": {
							"OcpiEndpointID": "*",
							"Action": []
						}
					},
					{
						"AuthObject": "Connections",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Connection",
						"AuthFieldValue": {
							"UserID": [
								{{#trim}}
									{{#userID}}
										"{{.}}",
									{{/userID}}
								{{/trim}}
							],
							"Action": ["Create", "Read", "Update", "Delete"]
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
					}, {
						"AuthObject": "Tenants",
						"AuthFieldValue": {
							"Action": []
						}
					}, {
						"AuthObject": "Tenant",
						"AuthFieldValue": {
							"TenantID": "*",
							"Action": []
						}
					},
					{
						"AuthObject": "Settings",
						"AuthFieldValue": {
							"Action": []
						}
					},
					{
						"AuthObject": "Setting",
						"AuthFieldValue": {
							"SettingID": "*",
							"Action": []
						}
					},
					{
						"AuthObject": "OcpiEndpoints",
						"AuthFieldValue": {
							"Action": []
						}
					},
					{
						"AuthObject": "OcpiEndpoint",
						"AuthFieldValue": {
							"OcpiEndpointID": "*",
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
							"Action": ["Create", "Read", "Update", "Delete", 
										"Reset", "ClearCache", "GetConfiguration", "ChangeConfiguration", 
										"RemoteStartTransaction", "RemoteStopTransaction", "UnlockConnector", 
										"Authorize", "SetChargingProfile", "GetCompositeSchedule", "ClearChargingProfile",
										"GetDiagnostics", "UpdateFirmware"]
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
					}, {
						"AuthObject": "Tenants",
						"AuthFieldValue": {
							"Action": []
						}
					}, {
						"AuthObject": "Tenant",
						"AuthFieldValue": {
							"TenantID": "*",
							"Action": []
						}
					},
					{
						"AuthObject": "Settings",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Setting",
						"AuthFieldValue": {
							"SettingID": "*",
							"Action": ["Create", "Read", "Update", "Delete"]
						}
					},
					{
						"AuthObject": "OcpiEndpoints",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "OcpiEndpoint",
						"AuthFieldValue": {
							"OcpiEndpointID": "*",
							"Action": ["Create", "Read", "Update", "Delete", "Ping", "GenerateLocalToken", "Register", "SendEVSEStatuses"]
						}
					},
					{
						"AuthObject": "Connections",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					},
					{
						"AuthObject": "Connection",
						"AuthFieldValue": {
							"Action": ["Create", "Read", "Update", "Delete"]
						}
					}
				]
			}
		`;
  }

  static getSuperAdminAuthorizations() {
    return `
			{
				"id": "S",
				"name": "SuperAdmin",
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
							"Action": []
						}
					},
					{
						"AuthObject": "Company",
						"AuthFieldValue": {
							"CompanyID": "*",
							"Action": []
						}
					},
					{
						"AuthObject": "Sites",
						"AuthFieldValue": {
							"Action": []
						}
					},
					{
						"AuthObject": "Site",
						"AuthFieldValue": {
							"SiteID": "*",
							"Action": []
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
							"Action": []
						}
					},
					{
						"AuthObject": "SiteArea",
						"AuthFieldValue": {
							"SiteAreaID": "*",
							"Action": []
						}
					},
					{
						"AuthObject": "ChargingStations",
						"AuthFieldValue": {
							"Action": []
						}
					},
					{
						"AuthObject": "ChargingStation",
						"AuthFieldValue": {
							"ChargingStationID": "*",
							"Action": []
						}
					},
					{
						"AuthObject": "Transactions",
						"AuthFieldValue": {
							"Action": []
						}
					},
					{
						"AuthObject": "Transaction",
						"AuthFieldValue": {
							"UserID": "*",
							"Action": []
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
							"Action": []
						}
					}, {
						"AuthObject": "Tenants",
						"AuthFieldValue": {
							"Action": ["List"]
						}
					}, {
						"AuthObject": "Tenant",
						"AuthFieldValue": {
							"TenantID": "*",
							"Action": ["Create", "Read", "Update", "Delete"]
						}
					},
					{
						"AuthObject": "Settings",
						"AuthFieldValue": {
							"Action": []
						}
					},
					{
						"AuthObject": "Setting",
						"AuthFieldValue": {
							"SettingID": "*",
							"Action": []
						}
					},
					{
						"AuthObject": "OcpiEndpoints",
						"AuthFieldValue": {
							"Action": []
						}
					},
					{
						"AuthObject": "OcpiEndpoint",
						"AuthFieldValue": {
							"OcpiEndpointID": "*",
							"Action": []
						}
					}
				]
			}
		`;
  }
}

module.exports = AuthorizationsDefinition;
