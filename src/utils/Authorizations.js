require('source-map-support').install();

module.exports = {
	// Read the config file
	getAuthorizationFromRoleID(authorisations, roleID) {
		// Filter
		let matchingAuthorisation = authorisations.filter((authorisation) => {
			return authorisation.id === roleID;
		});
		// Only one role
		return (matchingAuthorisation.length > 0 ? matchingAuthorisation[0] : []);
	},

	getAuthorizations() {
		return `
			[
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
								"Action": ["Create", "Read", "Update", "Delete", "Logout"]
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
								"UserID": "*",
								"ChargingStationID": "*",
								"Action": ["Create", "Read", "Update", "Delete", "Reset", "ClearCache", "GetConfiguration", "ChangeConfiguration", "StartTransaction", "StopTransaction", "UnlockConnector"]
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
								"Action": ["Read", "Update", "Delete"]
							}
						},
						{
							"AuthObject": "Logging",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Pricing",
							"AuthFieldValue": {
								"Action": ["Read", "Update"]
							}
						}
					]
				},
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
								"UserID": ["{{ userID }}"],
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
								"SiteAreaID": [
									{{#trim}}
										{{#siteAreaID}}
											"{{.}}",
										{{/siteAreaID}}
									{{/trim}}
								],
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
								"UserID": ["{{userID}}"],
								"ChargingStationID": [
									{{#trim}}
										{{#chargingStationID}}
											"{{.}}",
										{{/chargingStationID}}
									{{/trim}}
								],
								"Action": ["Read", "StartTransaction", "StopTransaction", "UnlockConnector"]
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
								"UserID": ["{{userID }}"],
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "Logging",
							"AuthFieldValue": {
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
				},
				{
					"id": "C",
					"name": "Corporate",
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
								"Action": ["Read"]
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
								"UserID": "*",
								"ChargingStationID": "*",
								"Action": ["Read", "StartTransaction", "StopTransaction", "UnlockConnector"]
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
							"AuthObject": "Logging",
							"AuthFieldValue": {
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
				},
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
								"Action": ["Read"]
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
								"UserID": "*",
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
							"AuthObject": "Logging",
							"AuthFieldValue": {
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
			]
		`;
	}
};
