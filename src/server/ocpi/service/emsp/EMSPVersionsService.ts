import { NextFunction, Request, Response } from 'express';
import { OCPIServerRoute, OCPIServerRouteVersions, ServerAction } from '../../../../types/Server';

import OCPIUtils from '../../OCPIUtils';
import OCPIUtilsService from '../OCPIUtilsService';

export default class EMSPVersionsService {
  public static handleGetVersions(action: ServerAction, req: Request, res: Response, next: NextFunction): void {
    try {
      const versions = [
        {
          version: OCPIServerRouteVersions.VERSION_211,
          url: `https://${req.get('host')}/ocpi/emsp/${OCPIServerRouteVersions.VERSION_211}/`
        }
      ];
      res.json(OCPIUtils.success(versions));
    } catch (error) {
      next(error);
    }
  }

  public static getSupportedServices(action: ServerAction, req: Request, res: Response, next: NextFunction): void {
    const identifiers = Array.from(Object.values(OCPIServerRoute)).filter((identifier) => (identifier !== 'versions'));
    const fullUrl = OCPIUtilsService.getServiceUrl(req, 'emsp');
    // Build payload
    const supportedEndpoints = identifiers.map((identifier: string) => ({ identifier, url: `${fullUrl}/${OCPIServerRouteVersions.VERSION_211}/${identifier}/` }));
    // Return payload
    res.json(OCPIUtils.success({ 'version': OCPIServerRouteVersions.VERSION_211, 'endpoints': supportedEndpoints }));
    next();
  }
}
