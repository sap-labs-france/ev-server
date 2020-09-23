import { Action, AuthorizationDefinition, Entity } from '../types/Authorization';

import AccessControl from 'role-acl';
import BackendError from '../exception/BackendError';
import Constants from '../utils/Constants';
import TenantComponents from '../types/TenantComponents';

const AUTHORIZATION_DEFINITION: AuthorizationDefinition = {
  superAdmin: {
    grants: [
      { resource: Entity.USERS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.USER, action: [Action.CREATE, Action.READ, Action.UPDATE], attributes: ['*'] },
      {
        resource: Entity.USER, action: Action.DELETE, attributes: ['*'],
        condition: { Fn: 'NOT_EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: Entity.LOGGINGS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.LOGGING, action: Action.READ, attributes: ['*'] },
      { resource: Entity.TENANTS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.TENANT, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE], attributes: ['*'] },
      { resource: Entity.CAR_CATALOGS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.CAR_CATALOGS, action: Action.SYNCHRONIZE, attributes: ['*'] },
      { resource: Entity.CAR_CATALOG, action: Action.READ, attributes: ['*'] },
    ]
  },
  admin: {
    grants: [
      { resource: Entity.USERS, action: [Action.LIST, Action.SYNCHRONIZE_BILLING_USERS], attributes: ['*'] },
      { resource: Entity.USER, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.SYNCHRONIZE_BILLING_USER], attributes: ['*'] },
      {
        resource: Entity.USER, action: Action.DELETE, attributes: ['*'],
        condition: { Fn: 'NOT_EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: Entity.COMPANIES, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.TAGS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.TAG, action: [Action.CREATE, Action.UPDATE, Action.DELETE, Action.READ], attributes: ['*'] },
      { resource: Entity.CHARGING_PROFILES, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.CHARGING_PROFILE, action: [Action.READ], attributes: ['*'] },
      { resource: Entity.COMPANY, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE], attributes: ['*'] },
      { resource: Entity.SITES, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.SITE, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE], attributes: ['*'] },
      { resource: Entity.SITE_AREAS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.SITE_AREA, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE], attributes: ['*'] },
      { resource: Entity.CHARGING_STATIONS, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.CHARGING_STATION, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE,
          Action.RESET, Action.CLEAR_CACHE, Action.GET_CONFIGURATION, Action.CHANGE_CONFIGURATION,
          Action.REMOTE_START_TRANSACTION, Action.REMOTE_STOP_TRANSACTION, Action.STOP_TRANSACTION, Action.START_TRANSACTION,
          Action.UNLOCK_CONNECTOR, Action.AUTHORIZE, Action.SET_CHARGING_PROFILE, Action.GET_COMPOSITE_SCHEDULE,
          Action.CLEAR_CHARGING_PROFILE, Action.GET_DIAGNOSTICS, Action.UPDATE_FIRMWARE, Action.EXPORT_PARAMS,
          Action.CHANGE_AVAILABILITY], attributes: ['*']
      },
      { resource: Entity.TRANSACTIONS, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.TRANSACTION,
        action: [Action.READ, Action.UPDATE, Action.DELETE],
        attributes: ['*']
      },
      {
        resource: Entity.REPORT, action: [Action.READ], attributes: ['*']
      },
      { resource: Entity.LOGGINGS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.LOGGING, action: Action.READ, attributes: ['*'] },
      { resource: Entity.PRICING, action: [Action.READ, Action.UPDATE], attributes: ['*'] },
      { resource: Entity.BILLING, action: [Action.CHECK_CONNECTION] },
      { resource: Entity.TAXES, action: [Action.LIST], attributes: ['*'] },
      { resource: Entity.INVOICES, action: [Action.LIST, Action.SYNCHRONIZE], attributes: ['*'] },
      { resource: Entity.INVOICE, action: [Action.DOWNLOAD, Action.CREATE], attributes: ['*'] },
      { resource: Entity.ASSET, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE,
        Action.CHECK_CONNECTION, Action.RETRIEVE_CONSUMPTION], attributes: ['*'] },
      { resource: Entity.ASSETS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.SETTINGS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.SETTING, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE], attributes: ['*'] },
      { resource: Entity.TOKENS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.TOKEN, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE], attributes: ['*'] },
      { resource: Entity.OCPI_ENDPOINTS, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.OCPI_ENDPOINT,
        action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.PING, Action.GENERATE_LOCAL_TOKEN,
          Action.REGISTER, Action.TRIGGER_JOB],
        attributes: ['*']
      },
      { resource: Entity.CONNECTIONS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.CONNECTION, action: [Action.CREATE, Action.READ, Action.DELETE], attributes: ['*'] },
      { resource: Entity.CAR_CATALOGS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.CAR_CATALOG, action: Action.READ, attributes: ['*'] },
      { resource: Entity.CAR, action: Action.CREATE, attributes: ['*'] },
      { resource: Entity.CARS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.USERS_CARS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.USERS_CARS, action: Action.ASSIGN, attributes: ['*'] },
      { resource: Entity.CAR, action: Action.READ, attributes: ['*'] },
      { resource: Entity.CAR, action: Action.UPDATE, attributes: ['*'] },
      { resource: Entity.CAR, action: Action.DELETE, attributes: ['*'] },
      { resource: Entity.NOTIFICATION, action: Action.CREATE, attributes: ['*'] },
    ]
  },
  basic: {
    grants: [
      {
        resource: Entity.USER, action: [Action.READ, Action.UPDATE], attributes: ['*'],
        condition: { Fn: 'EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: Entity.ASSETS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.ASSET, action: Action.READ, attributes: ['*'] },
      { resource: Entity.COMPANIES, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.CAR_CATALOGS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.CAR_CATALOG, action: Action.READ, attributes: ['*'] },
      { resource: Entity.CAR, action: Action.CREATE, attributes: ['*'] },
      { resource: Entity.CAR, action: Action.UPDATE, attributes: ['*'] },
      { resource: Entity.CAR, action: Action.READ, attributes: ['*'] },
      { resource: Entity.CAR, action: Action.DELETE, attributes: ['*'] },
      { resource: Entity.CARS, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.COMPANY, action: Action.READ, attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'companies': '$.company' } }
      },
      { resource: Entity.INVOICES, action: [Action.LIST, Action.SYNCHRONIZE], attributes: ['*'] },
      {
        resource: Entity.INVOICE, action: [Action.DOWNLOAD], attributes: ['*'],
        condition: { Fn: 'EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: Entity.SITES, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.SITE, action: Action.READ, attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sites': '$.site' } }
      },
      { resource: Entity.SITE_AREAS, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.SITE_AREA, action: Action.READ, attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sites': '$.site' } }
      },
      { resource: Entity.CHARGING_STATIONS, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.CHARGING_STATION,
        action: [Action.READ, Action.UNLOCK_CONNECTOR],
        attributes: ['*']
      },
      {
        resource: Entity.CHARGING_STATION,
        action: [Action.REMOTE_START_TRANSACTION, Action.AUTHORIZE, Action.START_TRANSACTION],
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
        action: [Action.REMOTE_STOP_TRANSACTION, Action.STOP_TRANSACTION],
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
      { resource: Entity.TRANSACTIONS, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.TRANSACTION, action: [Action.READ], attributes: ['*'],
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
      { resource: Entity.SETTINGS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.SETTING, action: Action.READ, attributes: ['*'] },
      { resource: Entity.CONNECTIONS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.CONNECTION, action: [Action.CREATE], attributes: ['*'] },
      {
        resource: Entity.CONNECTION, action: [Action.READ, Action.DELETE], attributes: ['*'],
        condition: { Fn: 'EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: Entity.NOTIFICATION, action: Action.CREATE, attributes: ['*'] },
    ]
  },
  demo: {
    grants: [
      { resource: Entity.USER, action: Action.READ, attributes: ['*'] },
      { resource: Entity.ASSETS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.ASSET, action: Action.READ, attributes: ['*'] },
      { resource: Entity.COMPANIES, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.COMPANY, action: Action.READ, attributes: ['*'] },
      { resource: Entity.SITES, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.SITE, action: Action.READ, attributes: ['*'] },
      { resource: Entity.SITE_AREAS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.SITE_AREA, action: Action.READ, attributes: ['*'] },
      { resource: Entity.CHARGING_STATIONS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.CHARGING_STATION, action: Action.READ, attributes: ['*'] },
      { resource: Entity.TRANSACTIONS, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.TRANSACTION, action: Action.READ, attributes: ['*'],
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
      { resource: Entity.SETTINGS, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.SETTING, action: Action.READ, attributes: ['*'],
        condition: { Fn: 'EQUALS', args: { 'identifier': TenantComponents.ANALYTICS } }
      },
    ]
  },
  siteAdmin: {
    '$extend': {
      'basic': {}
    },
    grants: [
      { resource: Entity.USERS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.USER, action: [Action.READ], attributes: ['*'] },
      {
        resource: Entity.SITE, action: [Action.UPDATE], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sitesAdmin': '$.site' } }
      },
      {
        resource: Entity.SITE_AREA, action: [Action.CREATE, Action.UPDATE, Action.DELETE], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sites': '$.site' } }
      },
      {
        resource: Entity.CHARGING_STATION,
        action: [Action.UPDATE, Action.DELETE, Action.RESET, Action.CLEAR_CACHE, Action.GET_CONFIGURATION,
          Action.CHANGE_CONFIGURATION, Action.SET_CHARGING_PROFILE, Action.GET_COMPOSITE_SCHEDULE,
          Action.CLEAR_CHARGING_PROFILE, Action.GET_DIAGNOSTICS, Action.UPDATE_FIRMWARE, Action.REMOTE_STOP_TRANSACTION,
          Action.STOP_TRANSACTION, Action.EXPORT_PARAMS, Action.CHANGE_AVAILABILITY],
        attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sitesAdmin': '$.site' } }
      },
      { resource: Entity.CHARGING_PROFILES, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.CHARGING_PROFILE, action: [Action.READ], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sitesAdmin': '$.site' } }
      },
      {
        resource: Entity.TRANSACTION, action: [Action.READ], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sitesAdmin': '$.site' } }
      },
      {
        resource: Entity.REPORT, action: [Action.READ], attributes: ['*']
      },
      { resource: Entity.LOGGINGS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.LOGGING, action: Action.READ, attributes: ['*'], args: { 'sites': '$.site' } },
      { resource: Entity.TOKENS, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.TOKEN,
        action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE],
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
      { resource: Entity.USERS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.USER, action: [Action.READ], attributes: ['*'] },
      {
        resource: Entity.SITE, action: [Action.UPDATE], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sitesOwner': '$.site' } }
      },
      {
        resource: Entity.TRANSACTION, action: [Action.READ, Action.REFUND_TRANSACTION], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sitesOwner': '$.site' } }
      },
      {
        resource: Entity.REPORT, action: [Action.READ], attributes: ['*']
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
      this.accessControl = new AccessControl(AUTHORIZATION_DEFINITION);
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
