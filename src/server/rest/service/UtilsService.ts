import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import TenantComponents from '../../../types/TenantComponents';
import UserToken from '../../../types/UserToken';
import Utils from '../../../utils/Utils';

const MODULE_NAME = 'UtilsService';

export default class UtilsService {
  static handleUnknownAction(action: ServerAction, req: Request, res: Response, next: NextFunction): void {
    // Action provided
    if (!action) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(
        null, new Error('No Action has been provided'), req, res, next);
    } else {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(
        action, new Error(`The Action '${action}' does not exist`), req, res, next);
    }
  }

  public static assertIdIsProvided(action: ServerAction, id: string|number, module: string, method: string, userToken: UserToken): void {
    if (!id) {
      // Object does not exist
      throw new AppError({
        action,
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The ID must be provided',
        module: module,
        method: method,
        user: userToken
      });
    }
  }

  public static assertObjectExists(action: ServerAction, object: any, errorMsg: string, module: string, method: string, userToken?: UserToken): void {
    if (!object) {
      throw new AppError({
        action,
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: errorMsg,
        module: module,
        method: method,
        user: userToken
      });
    }
  }

  public static assertComponentIsActiveFromToken(userToken: UserToken, component: TenantComponents,
    action: Action, entity: Entity, module: string, method: string): void {
    // Check from token
    const active = Utils.isComponentActiveFromToken(userToken, component);
    // Throw
    if (!active) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        entity: entity, action: action,
        module: module, method: method,
        inactiveComponent: component,
        user: userToken
      });
    }
  }
}
