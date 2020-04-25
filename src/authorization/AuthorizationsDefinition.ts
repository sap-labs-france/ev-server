import AccessControl from 'role-acl';
import BackendError from '../exception/BackendError';
import TenantComponents from '../types/TenantComponents';
import Constants from '../utils/Constants';
import { Entity } from '../types/Authorization';

const GRANTS = {
  superAdmin: {
    grants: [
      { resource: Entity.USERS, action: 'List', attributes: ['*'] },
      { resource: Entity.USER, action: ['Create', 'Read', 'Update'], attributes: ['*'] },
      {
        resource: Entity.USER, action: 'Delete', attributes: ['*'],
        condition: { Fn: 'NOT_EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: Entity.LOGGINGS, action: 'List', attributes: ['*'] },
      { resource: Entity.LOGGING, action: 'Read', attributes: ['*'] },
      { resource: Entity.TENANTS, action: 'List', attributes: ['*'] },
      { resource: Entity.TENANT, action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: Entity.CAR_CATALOGS, action: 'List', attributes: ['*'] },
      { resource: Entity.CAR_CATALOGS, action: 'SynchronizeCarCatalogs', attributes: ['*'] },
      { resource: Entity.CAR_CATALOG, action: 'Read', attributes: ['*'] },
    ]
  },
  admin: {
    grants: [
      { resource: Entity.USERS, action: 'List', attributes: ['*'] },
      { resource: Entity.USER, action: ['Create', 'Read', 'Update'], attributes: ['*'] },
      {
        resource: Entity.USER, action: 'Delete', attributes: ['*'],
        condition: { Fn: 'NOT_EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: Entity.COMPANIES, action: 'List', attributes: ['*'] },
      { resource: Entity.COMPANY, action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: Entity.SITES, action: 'List', attributes: ['*'] },
      { resource: Entity.SITE, action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: Entity.SITE_AREAS, action: 'List', attributes: ['*'] },
      { resource: Entity.SITE_AREA, action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: Entity.CHARGING_STATIONS, action: 'List', attributes: ['*'] },
      {
        resource: Entity.CHARGING_STATION, action: ['Create', 'Read', 'Update', 'Delete',
          'Reset', 'ClearCache', 'GetConfiguration', 'ChangeConfiguration',
          'RemoteStartTransaction', 'RemoteStopTransaction', 'UnlockConnector',
          'Authorize', 'SetChargingProfile', 'GetCompositeSchedule', 'ClearChargingProfile',
          'GetDiagnostics', 'UpdateFirmware', 'ExportParams', 'ChangeAvailability'], attributes: ['*']
      },
      { resource: Entity.TRANSACTIONS, action: 'List', attributes: ['*'] },
      {
        resource: Entity.TRANSACTION,
        action: ['Read', 'Update', 'Delete'],
        attributes: ['*']
      },
      {
        resource: Entity.REPORT, action: ['Read'], attributes: ['*']
      },
      { resource: Entity.LOGGINGS, action: 'List', attributes: ['*'] },
      { resource: Entity.LOGGING, action: 'Read', attributes: ['*'] },
      { resource: Entity.PRICING, action: ['Read', 'Update'], attributes: ['*'] },
      {
        resource: Entity.BILLING,
        action: ['BillingCheckConnection', 'BillingSynchronizeUsers', 'BillingSynchronizeUser']
      },
      { resource: Entity.TAXES, action: ['List'], attributes: ['*'] },
      { resource: Entity.INVOICES, action: ['List'], attributes: ['*'] },
      { resource: Entity.ASSET, action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: Entity.ASSETS, action: 'List', attributes: ['*'] },
      { resource: Entity.SETTINGS, action: 'List', attributes: ['*'] },
      { resource: Entity.SETTING, action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: Entity.TOKENS, action: 'List', attributes: ['*'] },
      { resource: Entity.TOKEN, action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: Entity.OCPI_ENDPOINTS, action: 'List', attributes: ['*'] },
      {
        resource: Entity.OCPI_ENDPOINT,
        action: ['Create', 'Read', 'Update', 'Delete', 'Ping', 'GenerateLocalToken', 'Register', 'TriggerJob'],
        attributes: ['*']
      },
      { resource: Entity.CONNECTIONS, action: 'List', attributes: ['*'] },
      { resource: Entity.CONNECTION, action: ['Create', 'Read', 'Delete'], attributes: ['*'] },
      { resource: Entity.CAR_CATALOGS, action: 'List', attributes: ['*'] },
      { resource: Entity.CAR_CATALOG, action: 'Read', attributes: ['*'] },
    ]
  },
  basic: {
    grants: [
      {
        resource: Entity.USER, action: ['Read', 'Update'], attributes: ['*'],
        condition: { Fn: 'EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: Entity.ASSETS, action: 'List', attributes: ['*'] },
      { resource: Entity.ASSET, action: 'Read', attributes: ['*'] },
      { resource: Entity.COMPANIES, action: 'List', attributes: ['*'] },
      {
        resource: Entity.COMPANY, action: 'Read', attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'companies': '$.company' } }
      },
      { resource: Entity.INVOICES, action: ['List'], attributes: ['*'] },
      { resource: Entity.INVOICE, action: ['Download'], attributes: ['*'] },
      { resource: Entity.SITES, action: 'List', attributes: ['*'] },
      {
        resource: Entity.SITE, action: 'Read', attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sites': '$.site' } }
      },
      { resource: Entity.SITE_AREAS, action: 'List', attributes: ['*'] },
      {
        resource: Entity.SITE_AREA, action: 'Read', attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sites': '$.site' } }
      },
      { resource: Entity.CHARGING_STATIONS, action: 'List', attributes: ['*'] },
      {
        resource: Entity.CHARGING_STATION,
        action: ['Read', 'UnlockConnector'],
        attributes: ['*']
      },
      {
        resource: Entity.CHARGING_STATION,
        action: ['RemoteStartTransaction', 'Authorize'],
        attributes: ['*'],
        condition: {
          Fn: 'OR',
          args: [
            {
              Fn: 'EQUALS',
              args: { 'site': null }
            },
            {
              Fn: 'LIST_CONTAINS',
              args: {
                'sites': '$.site'
              }
            }
          ]
        }
      },
      {
        resource: Entity.CHARGING_STATION,
        action: 'RemoteStopTransaction',
        attributes: ['*'],
        condition: {
          Fn: 'OR',
          args: [
            {
              Fn: 'EQUALS',
              args: { 'user': '$.owner' }
            },
            {
              Fn: 'LIST_CONTAINS',
              args: {
                'tagIDs': '$.tagID'
              }
            }
          ]
        }
      },
      { resource: Entity.TRANSACTIONS, action: 'List', attributes: ['*'] },
      {
        resource: Entity.TRANSACTION, action: ['Read'], attributes: ['*'],
        condition: {
          Fn: 'OR',
          args: [
            {
              Fn: 'EQUALS',
              args: { 'user': '$.owner' }
            },
            {
              Fn: 'LIST_CONTAINS',
              args: {
                'tagIDs': '$.tagID'
              }
            }
          ]
        }
      },
      { resource: Entity.SETTINGS, action: 'List', attributes: ['*'] },
      { resource: Entity.SETTING, action: 'Read', attributes: ['*'] },
      { resource: Entity.CONNECTIONS, action: 'List', attributes: ['*'] },
      { resource: Entity.CONNECTION, action: ['Create'], attributes: ['*'] },
      {
        resource: Entity.CONNECTION, action: ['Read', 'Delete'], attributes: ['*'],
        condition: { Fn: 'EQUALS', args: { 'user': '$.owner' } }
      },
    ]
  },
  demo: {
    grants: [
      { resource: Entity.USER, action: 'Read', attributes: ['*'] },
      { resource: Entity.ASSETS, action: 'List', attributes: ['*'] },
      { resource: Entity.ASSET, action: 'Read', attributes: ['*'] },
      { resource: Entity.COMPANIES, action: 'List', attributes: ['*'] },
      { resource: Entity.COMPANY, action: 'Read', attributes: ['*'] },
      { resource: Entity.SITES, action: 'List', attributes: ['*'] },
      { resource: Entity.SITE, action: 'Read', attributes: ['*'] },
      { resource: Entity.SITE_AREAS, action: 'List', attributes: ['*'] },
      { resource: Entity.SITE_AREA, action: 'Read', attributes: ['*'] },
      { resource: Entity.CHARGING_STATIONS, action: 'List', attributes: ['*'] },
      { resource: Entity.CHARGING_STATION, action: 'Read', attributes: ['*'] },
      { resource: Entity.TRANSACTIONS, action: 'List', attributes: ['*'] },
      {
        resource: Entity.TRANSACTION, action: 'Read', attributes: ['*'],
        condition: {
          Fn: 'OR',
          args: [
            {
              Fn: 'EQUALS',
              args: { 'site': null }
            },
            {
              Fn: 'LIST_CONTAINS',
              args: {
                'sites': '$.site'
              }
            }
          ]
        }
      },
      { resource: Entity.SETTINGS, action: 'List', attributes: ['*'] },
      {
        resource: Entity.SETTING, action: 'Read', attributes: ['*'],
        condition: { Fn: 'EQUALS', args: { 'identifier': TenantComponents.ANALYTICS } }
      },
    ]
  },
  siteAdmin: {
    '$extend': {
      'basic': {}
    },
    grants: [
      { resource: Entity.USERS, action: 'List', attributes: ['*'] },
      { resource: Entity.USER, action: ['Read'], attributes: ['*'] },
      {
        resource: Entity.SITE, action: ['Update'], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sitesAdmin': '$.site' } }
      },
      {
        resource: Entity.SITE_AREA, action: ['Create', 'Update', 'Delete'], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sites': '$.site' } }
      },
      {
        resource: Entity.CHARGING_STATION,
        action: ['Update', 'Delete',
          'Reset', 'ClearCache', 'GetConfiguration', 'ChangeConfiguration',
          'SetChargingProfile', 'GetCompositeSchedule', 'ClearChargingProfile',
          'GetDiagnostics', 'UpdateFirmware', 'RemoteStopTransaction', 'ExportParams', 'ChangeAvailability'],
        attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sitesAdmin': '$.site' } }
      },
      {
        resource: Entity.TRANSACTION, action: ['Read'], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sitesAdmin': '$.site' } }
      },
      {
        resource: Entity.REPORT, action: ['Read'], attributes: ['*']
      },
      { resource: Entity.LOGGINGS, action: 'List', attributes: ['*'] },
      { resource: Entity.LOGGING, action: 'Read', attributes: ['*'], args: { 'sites': '$.site' } },
      { resource: Entity.TOKENS, action: 'List', attributes: ['*'] },
      {
        resource: Entity.TOKEN,
        action: ['Create', 'Read'],
        attributes: ['*'],
        args: { 'sites': '$.site' }
      },
    ]
  },
  siteOwner: {
    '$extend': {
      'basic': {}
    },
    grants: [
      { resource: Entity.USERS, action: 'List', attributes: ['*'] },
      { resource: Entity.USER, action: ['Read'], attributes: ['*'] },
      {
        resource: Entity.SITE, action: ['Update'], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sitesOwner': '$.site' } }
      },
      {
        resource: Entity.TRANSACTION, action: ['Read', 'RefundTransaction'], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sitesOwner': '$.site' } }
      },
      {
        resource: Entity.REPORT, action: ['Read'], attributes: ['*']
      },
    ]
  },
};

const MODULE_NAME = 'AuthorizationsDefinition';

export default class AuthorizationsDefinition {

  private static _instance: AuthorizationsDefinition;
  private accessControl: AccessControl;

  private constructor() {
    try {
      this.accessControl = new AccessControl(GRANTS);
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'getScopes',
        message: 'Unable to load authorization grants',
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }

  public static getInstance(): AuthorizationsDefinition {
    if (!AuthorizationsDefinition._instance) {
      AuthorizationsDefinition._instance = new AuthorizationsDefinition();
    }
    return AuthorizationsDefinition._instance;
  }

  public getScopes(groups: ReadonlyArray<string>): ReadonlyArray<string> {
    const scopes = [];
    try {
      this.accessControl.allowedResources({ role: groups }).forEach(
        (resource: string): void => {
          this.accessControl.allowedActions({ role: groups, resource: resource }).forEach(
            (action: string): number => scopes.push(`${resource}:${action}`)
          );
        }
      );
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'getScopes',
        message: 'Unable to load available scopes',
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
    return scopes;
  }

  public can(role: ReadonlyArray<string>, resource: string, action: string, context?): boolean {
    try {
      const permission = this.accessControl.can(role).execute(action).with(context).on(resource);
      return permission.granted;
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'can',
        message: 'Unable to check authorization',
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }
}
