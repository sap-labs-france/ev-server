import { NextFunction, Request, Response } from 'express';
import AppError from '../../../exception/AppError';
import ComponentInactiveError from '../../../exception/ComponentInactiveError';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import UserToken from '../../../types/UserToken';
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

  public static assertIdIsProvided(id: string, module: string, method: string, userToken) {
    if (!id) {
      // Object does not exist
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The ID must be provided',
        Constants.HTTP_GENERAL_ERROR,
        module, method, userToken);
    }
  }

  public static assertObjectExists(object: any, errorMsg: string, module: string, method: string, userToken) {
    if (!object) {
      // Object does not exist
      throw new AppError(
        Constants.CENTRAL_SERVER,
        errorMsg,
        Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        module, method, userToken);
    }
  }

  public static assertComponentIsActiveFromToken(userToken: UserToken, component: string, action: string, entity: string, module: string, method: string) {
    // Check from token
    const active = Utils.isComponentActiveFromToken(userToken, component);
    // Throw
    if (!active) {
      throw new ComponentInactiveError(
        component, action, entity,
        Constants.HTTP_AUTH_ERROR,
        module, method);
    }
  }
}
