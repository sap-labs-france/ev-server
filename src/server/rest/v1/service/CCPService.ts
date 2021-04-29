import { NextFunction, Request, Response } from 'express';

import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import Configuration from '../../../../utils/Configuration';
import Constants from '../../../../utils/Constants';
import ContractCertificatePoolClient from '../../../../client/contractcertificatepool/ContractCertificatePoolClient';
import { ContractCertificatePoolType } from '../../../../types/configuration/ContractsCertificatePoolConfiguration';
import { HTTPError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import sanitize from 'mongo-sanitize';

const MODULE_NAME = 'CPPService';

export default class CPPService {
  public static async handleCCPSwitch(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.isAdmin(req.user)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: StatusCodes.UNAUTHORIZED,
        message: 'User is not a tenant administrator',
        module: MODULE_NAME,
        method: 'handleCCPSwitch',
        action: action
      });
    }
    const ccpType: ContractCertificatePoolType = sanitize(req.body.ccpType);
    if (!ccpType) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `Contract Certificate Pool type ${ccpType.toString()} is not defined in the request`,
        module: MODULE_NAME,
        method: 'handleCCPSwitch',
        action: action
      });
    }
    let ccpIndex = 0;
    for (const pool of Configuration.getContractCertificatePool().pools) {
      if (pool.type === ccpType) {
        break;
      }
      ccpIndex++;
    }
    if (ccpIndex < 0 || ccpIndex > Configuration.getContractCertificatePool().pools.length - 1) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `Contract Certificate Pool type ${ccpType} does not exist in configuration`,
        module: MODULE_NAME,
        method: 'handleCCPSwitch',
        action: action
      });
    }
    await Logging.logInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCCPSwitch',
      message: `Contract Certificate Pool type switched to ${ccpType} (index: ${ccpIndex.toString()})`,
      action: action,
    });
    ContractCertificatePoolClient.getInstance().ccpIndex = ccpIndex;
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
