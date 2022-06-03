import { AUTHORIZATION_CONDITIONS, AUTHORIZATION_DEFINITION } from './AuthorizationsDefinition';
import { AuthorizationContext, AuthorizationResult } from '../types/Authorization';

import { AccessControl } from 'role-acl';
import AuthorizationValidatorStorage from '../storage/validator/AuthorizationValidatorStorage';
import BackendError from '../exception/BackendError';
import Logging from '../utils/Logging';

const MODULE_NAME = 'AuthorizationsManager';

export default class AuthorizationsManager {
  private static instance: AuthorizationsManager;
  private static authorizationCache: Map<string, AuthorizationResult> = new Map();
  private accessControl: AccessControl;

  private constructor() {
    // Validate each role
    for (const roleName in AUTHORIZATION_DEFINITION) {
      const role = AUTHORIZATION_DEFINITION[roleName];
      try {
        // Validate the role
        AUTHORIZATION_DEFINITION[roleName] = AuthorizationValidatorStorage.getInstance().validateAuthorizationDefinitionRoleSave(role);
      } catch (error) {
        Logging.logConsoleError(error.stack);
        throw new BackendError({
          module: MODULE_NAME, method: 'constructor',
          message: `Unable to init authorization definition for role '${roleName}'`,
          detailedMessages: { error: error.stack, role }
        });
      }
    }
    try {
      // Instantiate the ACLs
      this.accessControl = new AccessControl(AUTHORIZATION_DEFINITION, AUTHORIZATION_CONDITIONS);
    } catch (error) {
      Logging.logConsoleError(error.stack);
      throw new BackendError({
        module: MODULE_NAME, method: 'constructor',
        message: 'Unable to init authorization definition',
        detailedMessages: { error: error.stack }
      });
    }
  }

  public static getInstance(): AuthorizationsManager {
    if (!AuthorizationsManager.instance) {
      AuthorizationsManager.instance = new AuthorizationsManager();
    }
    return AuthorizationsManager.instance;
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
        module: MODULE_NAME,
        method: 'getScopes',
        message: 'Unable to load available scopes',
        detailedMessages: { error: error.stack }
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
        module: MODULE_NAME,
        method: 'can',
        message: 'Unable to check authorization',
        detailedMessages: { error: error.stack }
      });
    }
  }

  public async canPerformAction(roles: string[], resource: string, action: string, context: AuthorizationContext = {}): Promise<AuthorizationResult> {
    try {
      const authID = `${roles.toString()}~${resource}~${action}~${JSON.stringify(context)}}`;
      // Check in cache
      let authResult = AuthorizationsManager.authorizationCache.get(authID);
      if (!authResult) {
        // Not found: Compute & Store in cache
        const permission = await this.accessControl.can(roles).execute(action).with(context).on(resource);
        authResult = {
          authorized: permission.granted,
          fields: permission.attributes,
          context: context,
        };
        AuthorizationsManager.authorizationCache.set(authID, Object.freeze(authResult));
      } else {
        // Enrich the current context
        for (const contextKey in authResult.context) {
          context[contextKey] = authResult.context[contextKey];
        }
      }
      return authResult;
    } catch (error) {
      throw new BackendError({
        module: MODULE_NAME,
        method: 'canPerformAction',
        message: 'Unable to check authorization',
        detailedMessages: { error: error.stack }
      });
    }
  }
}
