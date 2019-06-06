import Constants from '../utils/Constants';
require('source-map-support').install();

export default class AuthorizationsDefinition {

  static getGrants() {
    return {
      S: {
        grants: [
          {resource: 'Users', action: 'List', attributes: ['*']},
          {resource: 'User', action: ['Create', 'Read', 'Update'], attributes: ['*']},
          {
            resource: 'User',
            action: 'Delete',
            attributes: ['*'],
            condition: {Fn: 'NOT_EQUALS', args: {'user': '$.owner'}}
          },
          {resource: 'Loggings', action: 'List', attributes: ['*']},
          {resource: 'Logging', action: 'Read', attributes: ['*']},
          {resource: 'Tenants', action: 'List', attributes: ['*']},
          {resource: 'Tenant', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*']}
        ]
      },
      A: {
        grants: [
          {resource: 'Users', action: 'List', attributes: ['*']},
          {resource: 'User', action: ['Create', 'Read', 'Update'], attributes: ['*']},
          {
            resource: 'User',
            action: 'Delete',
            attributes: ['*'],
            condition: {Fn: 'NOT_EQUALS', args: {'user': '$.owner'}}
          },
          {resource: 'Companies', action: 'List', attributes: ['*']},
          {resource: 'Company', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*']},
          {resource: 'Sites', action: 'List', attributes: ['*']},
          {resource: 'Site', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*']},
          {resource: 'SiteAreas', action: 'List', attributes: ['*']},
          {resource: 'SiteArea', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*']},
          {resource: 'ChargingStations', action: 'List', attributes: ['*']},
          {
            resource: 'ChargingStation', action: ["Create", "Read", "Update", "Delete",
              "Reset", "ClearCache", "GetConfiguration", "ChangeConfiguration",
              "RemoteStartTransaction", "RemoteStopTransaction", "UnlockConnector",
              "Authorize", "SetChargingProfile", "GetCompositeSchedule", "ClearChargingProfile",
              "GetDiagnostics", "UpdateFirmware"], attributes: ['*']
          },
          {resource: 'Transactions', action: 'List', attributes: ['*']},
          {resource: 'Transaction', action: ["Read", "Update", "Delete", "RefundTransaction"], attributes: ['*']},
          {resource: 'Loggings', action: 'List', attributes: ['*']},
          {resource: 'Logging', action: 'Read', attributes: ['*']},
          {resource: 'Pricing', action: ["Read", "Update"], attributes: ['*']},
          {resource: 'Settings', action: 'List', attributes: ['*']},
          {resource: 'Setting', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*']},
          {resource: 'OcpiEndpoints', action: 'List', attributes: ['*']},
          {
            resource: 'OcpiEndpoint',
            action: ["Create", "Read", "Update", "Delete", "Ping", "GenerateLocalToken", "Register", "SendEVSEStatuses"],
            attributes: ['*']
          },
          {resource: 'Connections', action: 'List', attributes: ['*']},
          {resource: 'Connection', action: ['Create', 'Read', 'Delete'], attributes: ['*']}
        ]
      },
      B: {
        grants: [
          {
            resource: 'User', action: ['Read', 'Update'], attributes: ['*'],
            condition: {Fn: 'EQUALS', args: {'user': '$.owner'}}
          },
          {resource: 'Companies', action: 'List', attributes: ['*']},
          {
            resource: 'Company', action: ['Read'], attributes: ['*'],
            condition: {Fn: 'LIST_CONTAINS', args: {'companies': '$.company'}}
          },
          {resource: 'Sites', action: 'List', attributes: ['*']},
          {
            resource: 'Site', action: ['Read'], attributes: ['*'],
            condition: {Fn: 'LIST_CONTAINS', args: {'sites': '$.site'}}
          },
          {resource: 'SiteAreas', action: 'List', attributes: ['*']},
          {resource: 'SiteArea', action: ['Read'], attributes: ['*']},
          {resource: 'ChargingStations', action: 'List', attributes: ['*']},
          {
            resource: 'ChargingStation',
            action: ["Read", "RemoteStartTransaction", "RemoteStopTransaction", "UnlockConnector", "Authorize"],
            attributes: ['*']
          },
          {resource: 'Transactions', action: 'List', attributes: ['*']},
          {
            resource: 'Transaction', action: ['Read', 'RefundTransaction'], attributes: ['*'],
            condition: {Fn: 'EQUALS', args: {'user': '$.owner'}}
          },
          {resource: 'Settings', action: 'List', attributes: ['*']},
          {resource: 'Setting', action: 'Read', attributes: ['*']},
          {resource: 'Connections', action: 'List', attributes: ['*']},
          {
            resource: 'Connection', action: ["Create", "Read", "Delete"], attributes: ['*'],
            condition: {Fn: 'EQUALS', args: {'user': '$.owner'}}
          },
        ]
      },
      D: {
        grants: [
          {resource: 'User', action: ['Read'], attributes: ['*']},
          {resource: 'Companies', action: 'List', attributes: ['*']},
          {resource: 'Company', action: 'Read', attributes: ['*']},
          {resource: 'Sites', action: 'List', attributes: ['*']},
          {resource: 'Site', action: 'Read', attributes: ['*']},
          {resource: 'SiteAreas', action: 'List', attributes: ['*']},
          {resource: 'SiteArea', action: 'Read', attributes: ['*']},
          {resource: 'ChargingStations', action: 'List', attributes: ['*']},
          {resource: 'ChargingStation', action: 'Read', attributes: ['*']},
          {resource: 'Transactions', action: 'List', attributes: ['*']},
          {resource: 'Transaction', action: 'Read', attributes: ['*']},
        ]
      }
    };
  }
}
