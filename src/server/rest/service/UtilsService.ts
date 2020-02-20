import { NextFunction, Request, Response } from 'express';
import AppError from '../../../exception/AppError';
import { Action } from '../../../types/Authorization';
import { HTTPError } from '../../../types/HTTPError';
import UserToken from '../../../types/UserToken';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';


export default class UtilsService {
  static handleUnknownAction(action: string, req: Request, res: Response, next: NextFunction) {
    // Action provided
    if (!action) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(
        'N/A', new Error('No Action has been provided'), req, res, next);
    } else {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(
        action, new Error(`The Action '${action}' does not exist`), req, res, next);
    }
  }

  public static assertIdIsProvided(action: Action, id: string|number, module: string, method: string, userToken: UserToken) {
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

  public static assertObjectExists(action: Action, object: any, errorMsg: string, module: string, method: string, userToken: UserToken) {
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

  public static assertComponentIsActiveFromToken(userToken: UserToken, component: string, action: Action, entity: string, module: string, method: string) {
    // Check from token
    const active = Utils.isComponentActiveFromToken(userToken, component);
    // Throw
    if (!active) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        message: `Component ${component} is inactive - Not allowed to perform '${action}' on '${entity}'`,
        action: action,
        module: module,
        method: method,
        errorCode: HTTPError.GENERAL_ERROR,
      });
    }
  }
}
