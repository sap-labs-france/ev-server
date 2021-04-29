import { AccessControl, IDictionary, IFunctionCondition } from 'role-acl';
import { Action, AuthorizationContext, AuthorizationDefinition, AuthorizationResult, Entity } from '../types/Authorization';

import BackendError from '../exception/BackendError';
import Constants from '../utils/Constants';

const AUTHORIZATION_DEFINITION: AuthorizationDefinition = {
  superAdmin: {
    grants: [
      { resource: Entity.USERS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.USER, action: [Action.CREATE, Action.UPDATE], attributes: ['*'] },
      {
        resource: Entity.USER, action: Action.DELETE, attributes: ['*'],
        condition: { Fn: 'NOT_EQUALS', args: { 'user': '$.owner' } }
      },
      {
        resource: Entity.USER, action: Action.READ, attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'plateID',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'address'
        ]
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
      { resource: Entity.USERS, action: [Action.LIST, Action.SYNCHRONIZE_BILLING_USERS, Action.EXPORT, Action.IN_ERROR, Action.IMPORT], attributes: ['*'] },
      { resource: Entity.USER, action: [Action.CREATE, Action.UPDATE, Action.SYNCHRONIZE_BILLING_USER], attributes: ['*'] },
      {
        resource: Entity.USER, action: Action.DELETE, attributes: ['*'],
        condition: { Fn: 'NOT_EQUALS', args: { 'user': '$.owner' } },
      },
      {
        resource: Entity.USER, action: Action.READ, attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'plateID',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'address'
        ]
      },
      {
        resource: Entity.COMPANIES, action: Action.LIST, attributes: [
          'id', 'name', 'address', 'logo', 'issuer', 'distanceMeters', 'createdOn', 'lastChangedOn',
          'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName'
        ]
      },
      { resource: Entity.TAGS, action: [Action.LIST, Action.IMPORT], attributes: ['*'] },
      { resource: Entity.TAG, action: [Action.CREATE, Action.UPDATE, Action.DELETE, Action.READ], attributes: ['*'] },
      { resource: Entity.CHARGING_PROFILES, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.CHARGING_PROFILE, action: [Action.READ], attributes: ['*'] },
      { resource: Entity.COMPANY, action: Action.READ, attributes: ['id', 'name', 'issuer', 'logo', 'address'] },
      { resource: Entity.COMPANY, action: [Action.CREATE, Action.UPDATE, Action.DELETE], attributes: ['*'] },
      {
        resource: Entity.SITES, action: Action.LIST, attributes: [
          'id', 'name', 'address', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn',
          'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName'
        ]
      },
      {
        resource: Entity.SITE, action: Action.READ, attributes: [
          'id', 'name', 'address', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn'
        ]
      },
      { resource: Entity.SITE, action: [Action.CREATE, Action.UPDATE, Action.DELETE], attributes: ['*'] },
      { resource: Entity.SITE_AREAS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.SITE_AREA, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE], attributes: ['*'] },
      { resource: Entity.CHARGING_STATIONS, action: [Action.LIST, Action.IN_ERROR], attributes: ['*'] },
      {
        resource: Entity.CHARGING_STATION, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE,
          Action.RESET, Action.CLEAR_CACHE, Action.GET_CONFIGURATION, Action.CHANGE_CONFIGURATION,
          Action.REMOTE_START_TRANSACTION, Action.REMOTE_STOP_TRANSACTION, Action.STOP_TRANSACTION, Action.START_TRANSACTION,
          Action.UNLOCK_CONNECTOR, Action.AUTHORIZE, Action.SET_CHARGING_PROFILE, Action.GET_COMPOSITE_SCHEDULE,
          Action.CLEAR_CHARGING_PROFILE, Action.GET_DIAGNOSTICS, Action.UPDATE_FIRMWARE, Action.EXPORT,
          Action.CHANGE_AVAILABILITY], attributes: ['*']
      },
      { resource: Entity.TRANSACTIONS, action: [Action.LIST, Action.EXPORT, Action.IN_ERROR], attributes: ['*'] },
      {
        resource: Entity.TRANSACTION,
        action: [Action.READ, Action.UPDATE, Action.DELETE, Action.REFUND_TRANSACTION],
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
      {
        resource: Entity.ASSET, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE,
          Action.CHECK_CONNECTION, Action.RETRIEVE_CONSUMPTION], attributes: ['*']
      },
      { resource: Entity.ASSETS, action: [Action.LIST, Action.IN_ERROR], attributes: ['*'] },
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
      { resource: Entity.OICP_ENDPOINTS, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.OICP_ENDPOINT,
        action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.PING,
          Action.REGISTER, Action.TRIGGER_JOB],
        attributes: ['*']
      },
      { resource: Entity.CONNECTIONS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.CONNECTION, action: [Action.CREATE, Action.READ, Action.DELETE], attributes: ['*'] },
      { resource: Entity.CAR_CATALOGS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.CAR_CATALOG, action: Action.READ, attributes: ['*'] },
      { resource: Entity.CAR, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE], attributes: ['*'] },
      { resource: Entity.CARS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.USERS_CARS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.USERS_CARS, action: Action.ASSIGN, attributes: ['*'] },
      { resource: Entity.NOTIFICATION, action: Action.CREATE, attributes: ['*'] },
      {
        resource: Entity.USERS_SITES, action: Action.LIST, attributes: [
          'user.id', 'user.name', 'user.firstName', 'user.email', 'user.role', 'siteAdmin', 'siteOwner', 'siteID'
        ]
      },
      { resource: Entity.USERS_SITES, action: [Action.ASSIGN, Action.UNASSIGN], attributes: ['*'] },
      { resource: Entity.PAYMENT_METHODS, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.PAYMENT_METHOD, action: [Action.READ, Action.CREATE, Action.DELETE], attributes: ['*'],
        // TODO - rewrite delete method to send also the current user so basic can only delete its payment methods
        // condition: { Fn: 'EQUALS', args: { 'user': '$.owner' } }
      },
    ]
  },
  basic: {
    grants: [
      {
        resource: Entity.USER, action: Action.READ, attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'plateID',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'address'
        ],
        condition: { Fn: 'EQUALS', args: { 'user': '$.owner' } }
      },
      {
        resource: Entity.USER, action: Action.UPDATE, attributes: ['*'],
        condition: { Fn: 'EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: Entity.SETTING, action: Action.READ, attributes: ['*'] },
      { resource: Entity.ASSETS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.ASSET, action: Action.READ, attributes: ['*'] },
      { resource: Entity.CAR_CATALOGS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.CAR_CATALOG, action: Action.READ, attributes: ['*'] },
      { resource: Entity.CAR, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE], attributes: ['*'] },
      { resource: Entity.CARS, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.COMPANIES, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizationFilters',
          args: { filters: ['AssignedSitesCompanies'] }
        },
        attributes: ['id', 'name', 'address', 'logo', 'issuer', 'distanceMeters', 'createdOn', 'lastChangedOn']
      },
      {
        resource: Entity.COMPANY, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizationFilters',
          args: { filters: ['AssignedSitesCompanies'] }
        },
        attributes: ['id', 'name', 'issuer', 'logo', 'address']
      },
      // -----------------------------------------------------------------------------------------------
      // TODO - put it pack as soon as BILLING has been validated of SLF
      // -----------------------------------------------------------------------------------------------
      // { resource: Entity.INVOICES, action: [Action.LIST, Action.SYNCHRONIZE], attributes: ['*'] },
      // {
      //   resource: Entity.INVOICE, action: [Action.DOWNLOAD], attributes: ['*'],
      //   condition: { Fn: 'EQUALS', args: { 'user': '$.owner' } }
      // },
      // {
      //   resource: Entity.PAYMENT_METHOD, action: [Action.READ, Action.CREATE, Action.DELETE], attributes: ['*'],
      // TODO - rewrite delete method to send also the current user so basic can only delete its payment methods
      //   condition: { Fn: 'EQUALS', args: { 'user': '$.owner' } }
      // },
      // -----------------------------------------------------------------------------------------------
      {
        resource: Entity.SITES, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizationFilters',
          args: { filters: ['AssignedSites'] }
        },
        attributes: [
          'id', 'name', 'address', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn',
        ]
      },
      {
        resource: Entity.SITE, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizationFilters',
          args: { filters: ['AssignedSites'] }
        },
        attributes: [
          'id', 'name', 'address', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn',
        ]
      },
      { resource: Entity.SITE_AREAS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.SITE_AREA, action: Action.READ, attributes: ['*'] },
      { resource: Entity.CHARGING_STATIONS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.CHARGING_STATION, action: [Action.READ], attributes: ['*'] },
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
      { resource: Entity.TAG, action: Action.READ, attributes: ['*'] },
      { resource: Entity.TAGS, action: Action.LIST, attributes: ['*'] },
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
      { resource: Entity.TRANSACTIONS, action: [Action.LIST, Action.EXPORT], attributes: ['*'] },
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
      {
        resource: Entity.USER, action: [Action.READ], attributes: ['*'],
        condition: { Fn: 'EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: Entity.ASSETS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.ASSET, action: Action.READ, attributes: ['*'] },
      { resource: Entity.CAR_CATALOGS, action: Action.LIST, attributes: ['*'] },
      { resource: Entity.CAR_CATALOG, action: Action.READ, attributes: ['*'] },
      { resource: Entity.CAR, action: Action.READ, attributes: ['*'] },
      { resource: Entity.CARS, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.COMPANIES, action: Action.LIST, attributes: [
          'id', 'name', 'address', 'logo', 'issuer', 'distanceMeters', 'createdOn', 'lastChangedOn'
        ]
      },
      {
        resource: Entity.COMPANY, action: Action.READ, attributes: [
          'id', 'name', 'issuer', 'logo', 'address'
        ]
      },
      {
        resource: Entity.SITES, action: Action.LIST, attributes: [
          'id', 'name', 'address', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn',
        ]
      },
      {
        resource: Entity.SITE, action: Action.READ, attributes: [
          'id', 'name', 'address', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn',
        ]
      },
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
    ]
  },
  siteAdmin: {
    '$extend': {
      'basic': {}
    },
    grants: [
      { resource: Entity.USERS, action: Action.LIST, attributes: ['*'] },
      {
        resource: Entity.USER, action: [Action.READ], attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'plateID',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'address'
        ]
      },
      {
        resource: Entity.USERS_SITES, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizationFilters',
          args: { filters: ['SitesAdmin'] }
        },
        attributes: [
          'user.id', 'user.name', 'user.firstName', 'user.email', 'user.role', 'siteAdmin', 'siteOwner', 'siteID'
        ]
      },
      { resource: Entity.USERS_SITES, action: Action.UNASSIGN,
        condition: {
          Fn: 'custom:dynamicAuthorizationFilters',
          args: { filters: ['SitesAdmin'] }
        },
        attributes: ['*']
      },
      { resource: Entity.SITE, action: [Action.UPDATE],
        condition: {
          Fn: 'custom:dynamicAuthorizationFilters',
          args: { filters: ['SitesAdmin'] }
        },
        attributes: ['*'] },
      { resource: Entity.SITE_AREA, action: [Action.CREATE, Action.UPDATE, Action.DELETE], attributes: ['*'] },
      {
        resource: Entity.CHARGING_STATION,
        action: [Action.UPDATE, Action.DELETE, Action.RESET, Action.CLEAR_CACHE, Action.GET_CONFIGURATION,
          Action.CHANGE_CONFIGURATION, Action.SET_CHARGING_PROFILE, Action.GET_COMPOSITE_SCHEDULE,
          Action.CLEAR_CHARGING_PROFILE, Action.GET_DIAGNOSTICS, Action.UPDATE_FIRMWARE, Action.REMOTE_STOP_TRANSACTION,
          Action.STOP_TRANSACTION, Action.EXPORT, Action.CHANGE_AVAILABILITY],
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
      {
        resource: Entity.USER, action: Action.READ, attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'plateID',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'address'
        ]
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

const AUTHORIZATION_CONDITIONS: IDictionary<IFunctionCondition> = {
  dynamicAuthorizationFilters: (context: Record<string, any>, args: AuthorizationContext): boolean => {
    // Pass the dynamic filters to the context
    // Used by the caller to execute dynamic filters
    if (context) {
      context.filters = args.filters;
    }
    return true;
  }
};

const MODULE_NAME = 'AuthorizationsDefinition';

export default class AuthorizationsDefinition {
  private static instance: AuthorizationsDefinition;
  private accessControl: AccessControl;

  private constructor() {
    try {
      this.accessControl = new AccessControl(AUTHORIZATION_DEFINITION, AUTHORIZATION_CONDITIONS);
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'constructor',
        message: 'Unable to init authorization definition',
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }

  public static getInstance(): AuthorizationsDefinition {
    if (!AuthorizationsDefinition.instance) {
      AuthorizationsDefinition.instance = new AuthorizationsDefinition();
    }
    return AuthorizationsDefinition.instance;
  }

  public async getScopes(roles: string[]): Promise<string[]> {
    const scopes: string[] = [];
    try {
      for (const resource of await this.accessControl.allowedResources({ role: roles })) {
        for (const action of await this.accessControl.allowedActions({ role: roles, resource })) {
          scopes.push(`${resource}:${action}`);
        }
      }
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

  public async can(roles: string[], resource: string, action: string, context?: any): Promise<boolean> {
    try {
      const permission = await this.accessControl.can(roles).execute(action).with(context).on(resource);
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

  public async canPerformAction(roles: string[], resource: string, action: string, context?: any): Promise<AuthorizationResult> {
    try {
      const permission = await this.accessControl.can(roles).execute(action).with(context).on(resource);
      return {
        authorized: permission.granted,
        fields: permission.attributes,
      };
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'canPerformAction',
        message: 'Unable to check authorization',
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }
}
