import AccessControl from 'role-acl';
import InternalError from '../exception/InternalError';

const GRANTS = {
  superAdmin: {
    grants: [
      { resource: 'Users', action: 'List', attributes: ['*'] },
      { resource: 'User', action: ['Create', 'Read', 'Update'], attributes: ['*'] },
      {
        resource: 'User', action: 'Delete', attributes: ['*'],
        condition: { Fn: 'NOT_EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: 'Loggings', action: 'List', attributes: ['*'] },
      { resource: 'Logging', action: 'Read', attributes: ['*'] },
      { resource: 'Tenants', action: 'List', attributes: ['*'] },
      { resource: 'Tenant', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: 'Settings', action: 'List', attributes: ['*'] },
      { resource: 'Setting', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] }
    ]
  },
  admin: {
    grants: [
      { resource: 'Users', action: 'List', attributes: ['*'] },
      { resource: 'User', action: ['Create', 'Read', 'Update'], attributes: ['*'] },
      {
        resource: 'User', action: 'Delete', attributes: ['*'],
        condition: { Fn: 'NOT_EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: 'Companies', action: 'List', attributes: ['*'] },
      { resource: 'Company', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: 'Sites', action: 'List', attributes: ['*'] },
      { resource: 'Site', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: 'SiteAreas', action: 'List', attributes: ['*'] },
      { resource: 'SiteArea', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: 'ChargingStations', action: 'List', attributes: ['*'] },
      {
        resource: 'ChargingStation', action: ['Create', 'Read', 'Update', 'Delete',
          'Reset', 'ClearCache', 'GetConfiguration', 'ChangeConfiguration',
          'RemoteStartTransaction', 'RemoteStopTransaction', 'UnlockConnector',
          'Authorize', 'SetChargingProfile', 'GetCompositeSchedule', 'ClearChargingProfile',
          'GetDiagnostics', 'UpdateFirmware'], attributes: ['*']
      },
      { resource: 'Transactions', action: 'List', attributes: ['*'] },
      { resource: 'Transaction', action: ['Read', 'Update', 'Delete', 'RefundTransaction'], attributes: ['*'] },
      { resource: 'Loggings', action: 'List', attributes: ['*'] },
      { resource: 'Logging', action: 'Read', attributes: ['*'] },
      { resource: 'Pricing', action: ['Read', 'Update'], attributes: ['*'] },
      { resource: 'Settings', action: 'List', attributes: ['*'] },
      { resource: 'Setting', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: 'OcpiEndpoints', action: 'List', attributes: ['*'] },
      {
        resource: 'OcpiEndpoint',
        action: ['Create', 'Read', 'Update', 'Delete', 'Ping', 'GenerateLocalToken', 'Register', 'SendEVSEStatuses'],
        attributes: ['*']
      },
      { resource: 'Connections', action: 'List', attributes: ['*'] },
      { resource: 'Connection', action: ['Create', 'Read', 'Delete'], attributes: ['*'] }
    ]
  },
  basic: {
    grants: [
      {
        resource: 'User', action: ['Read', 'Update'], attributes: ['*'],
        condition: { Fn: 'EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: 'Companies', action: 'List', attributes: ['*'] },
      {
        resource: 'Company', action: 'Read', attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'companies': '$.company' } }
      },
      { resource: 'Sites', action: 'List', attributes: ['*'] },
      {
        resource: 'Site', action: 'Read', attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sites': '$.site' } }
      },
      {
        resource: 'SiteAreas', action: 'List', attributes: ['*']
      },
      {
        resource: 'SiteArea', action: 'Read', attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sites': '$.site' } }
      },
      { resource: 'ChargingStations', action: 'List', attributes: ['*'] },
      {
        resource: 'ChargingStation',
        action: ['Read', 'RemoteStartTransaction', 'RemoteStopTransaction', 'UnlockConnector', 'Authorize'],
        attributes: ['*']
      },
      { resource: 'Transactions', action: 'List', attributes: ['*'] },
      {
        resource: 'Transaction', action: ['Read', 'RefundTransaction'], attributes: ['*'],
        condition: { Fn: 'EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: 'Settings', action: 'List', attributes: ['*'] },
      { resource: 'Setting', action: 'Read', attributes: ['*'] },
      { resource: 'Connections', action: 'List', attributes: ['*'] },
      {
        resource: 'Connection', action: ['Create', 'Read', 'Delete'], attributes: ['*'],
        condition: { Fn: 'EQUALS', args: { 'user': '$.owner' } }
      },
    ]
  },
  demo: {
    grants: [
      { resource: 'User', action: 'Read', attributes: ['*'] },
      { resource: 'Companies', action: 'List', attributes: ['*'] },
      { resource: 'Company', action: 'Read', attributes: ['*'] },
      { resource: 'Sites', action: 'List', attributes: ['*'] },
      { resource: 'Site', action: 'Read', attributes: ['*'] },
      { resource: 'SiteAreas', action: 'List', attributes: ['*'] },
      { resource: 'SiteArea', action: 'Read', attributes: ['*'] },
      { resource: 'ChargingStations', action: 'List', attributes: ['*'] },
      { resource: 'ChargingStation', action: 'Read', attributes: ['*'] },
      { resource: 'Transactions', action: 'List', attributes: ['*'] },
      { resource: 'Transaction', action: 'Read', attributes: ['*'] },
    ]
  },
  siteAdmin: {
    '$extend': {
      'basic': {}
    },
    grants: [
      { resource: 'Users', action: 'List', attributes: ['*'] },
      { resource: 'User', action: ['Read', 'Update'], attributes: ['*'] },
      {
        resource: 'Site', action: ['Update', 'Delete'], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sites': '$.site' } }
      },
      {
        resource: 'SiteArea', action: ['Create', 'Update', 'Delete'], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sites': '$.site' } }
      },
      {
        resource: 'ChargingStation', action: ['Update', 'Delete',
          'Reset', 'ClearCache', 'GetConfiguration', 'ChangeConfiguration',
          'SetChargingProfile', 'GetCompositeSchedule', 'ClearChargingProfile',
          'GetDiagnostics', 'UpdateFirmware'], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sites': '$.site' } }
      },
      {
        resource: 'Transaction', action: 'Read', attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sites': '$.site' } }
      },
      { resource: 'Loggings', action: 'List', attributes: ['*'] },
      { resource: 'Logging', action: 'Read', attributes: ['*'], args: { 'sites': '$.site' } },
    ]
  }
};

export default class AuthorizationsDefinition {

  private static _instance: AuthorizationsDefinition;
  private accessControl: AccessControl;

  private constructor() {
    try {
      this.accessControl = new AccessControl(GRANTS);
    } catch (error) {
      throw new InternalError('Unable to load authorization grants', error);
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
            (action: string): number => {
              return scopes.push(`${resource}:${action}`);
            }
          );
        }
      );
    } catch (error) {
      throw new InternalError('Unable to load available scopes', error);
    }
    return scopes;
  }

  public can(role: ReadonlyArray<string>, resource: string, action: string, context?): boolean {
    try {
      const permission = this.accessControl.can(role).execute(action).with(context).on(resource);
      return permission.granted;
    } catch (error) {
      throw new InternalError('Unable to check authorization', error);
    }
  }
}
