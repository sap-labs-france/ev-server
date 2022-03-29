import { NextFunction, Request, Response } from 'express';

import AbstractEndpoint from '../../AbstractEndpoint';
import AbstractOCPIService from '../../../AbstractOCPIService';
import Logging from '../../../../../utils/Logging';
import { OCPICommandType } from '../../../../../types/ocpi/OCPICommandType';
import OCPIEndpoint from '../../../../../types/ocpi/OCPIEndpoint';
import { OCPIResponse } from '../../../../../types/ocpi/OCPIResponse';
import OCPIUtils from '../../../OCPIUtils';
import { ServerAction } from '../../../../../types/Server';
import Tenant from '../../../../../types/Tenant';

const MODULE_NAME = 'EMSPCommandsEndpoint';

export default class EMSPCommandsEndpoint extends AbstractEndpoint {
  public constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, 'commands');
  }

  public async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'POST':
        // Split URL Segments
        // /ocpi/cpo/2.0/commands/{command}
        // eslint-disable-next-line no-case-declarations
        const urlSegment = req.path.substring(1).split('/');
        // Remove action
        urlSegment.shift();
        // Get filters
        // eslint-disable-next-line no-case-declarations
        const command = urlSegment.shift();
        // eslint-disable-next-line no-case-declarations
        const commandId = urlSegment.shift();
        switch (command) {
          case OCPICommandType.START_SESSION:
          case OCPICommandType.STOP_SESSION:
          case OCPICommandType.RESERVE_NOW:
          case OCPICommandType.UNLOCK_CONNECTOR:
            await Logging.logInfo({
              tenantID: tenant.id,
              action: this.getAction(command),
              message: `OCPI response received for Command '${command}' with ID '${commandId}' - No action to be done` ,
              module: MODULE_NAME, method: 'process',
              detailedMessages: { response : req.body, ocpiEndpoint }
            });
            return OCPIUtils.success();
        }
    }
  }

  private getAction(command: OCPICommandType): ServerAction {
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

