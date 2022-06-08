import { NextFunction, Request, Response } from 'express';

import AppError from '../../../../../exception/AppError';
import Logging from '../../../../../utils/Logging';
import { OCPICommandResponseType } from '../../../../../types/ocpi/OCPICommandResponse';
import { OCPICommandType } from '../../../../../types/ocpi/OCPICommandType';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../../OCPIUtils';
import { ServerAction } from '../../../../../types/Server';
import { StatusCodes } from 'http-status-codes';

const MODULE_NAME = 'EMSPCommandsService';

export default class EMSPCommandsService {
  public static async handleCommand(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant } = req;
    // Split URL Segments
    // /ocpi/cpo/2.0/commands/{command}
    // eslint-disable-next-line no-case-declarations
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    // eslint-disable-next-line no-case-declarations
    const command = urlSegment.shift();
    if (!command) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleCommand', action,
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'OCPI Command is not provided',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // eslint-disable-next-line no-case-declarations
    const commandId = urlSegment.shift();
    switch (command) {
      case OCPICommandType.START_SESSION:
      case OCPICommandType.STOP_SESSION:
      case OCPICommandType.RESERVE_NOW:
      case OCPICommandType.UNLOCK_CONNECTOR:
        if (req.body?.result !== OCPICommandResponseType.ACCEPTED) {
          await Logging.logError({
            tenantID: tenant.id,
            action: EMSPCommandsService.getAction(command),
            message: `OCPI Callback '${req.body?.result as string}' received for Command '${command}' with ID '${commandId}'`,
            module: MODULE_NAME, method: 'process',
            detailedMessages: { response: req.body }
          });
        } else {
          await Logging.logInfo({
            tenantID: tenant.id,
            action: EMSPCommandsService.getAction(command),
            message: `OCPI Callback '${req.body?.result as string}' received for Command '${command}' with ID '${commandId}'`,
            module: MODULE_NAME, method: 'process',
            detailedMessages: { response: req.body }
          });
        }
        res.json(OCPIUtils.success());
        next();
    }
  }

  private static getAction(command: OCPICommandType): ServerAction {
    switch (command) {
      case OCPICommandType.START_SESSION:
        return ServerAction.OCPI_EMSP_START_SESSION;
      case OCPICommandType.STOP_SESSION:
        return ServerAction.OCPI_EMSP_STOP_SESSION;
      case OCPICommandType.RESERVE_NOW:
        return ServerAction.OCPI_EMSP_RESERVE_NOW;
      case OCPICommandType.UNLOCK_CONNECTOR:
        return ServerAction.OCPI_EMSP_UNLOCK_CONNECTOR;
    }
  }
}

