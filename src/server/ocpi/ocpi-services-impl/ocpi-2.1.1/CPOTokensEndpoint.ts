import { NextFunction, Request, Response } from 'express';

import AbstractEndpoint from '../AbstractEndpoint';
import AbstractOCPIService from '../../AbstractOCPIService';
import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import HttpStatusCodes from 'http-status-codes';
import Logging from '../../../../utils/Logging';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import OCPIMapping from './OCPIMapping';
import { OCPIResponse } from '../../../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../../../types/ocpi/OCPIStatusCode';
import { OCPIToken } from '../../../../types/ocpi/OCPIToken';
import OCPITokensService from './OCPITokensService';
import OCPIUtils from '../../OCPIUtils';
import Tenant from '../../../../types/Tenant';
import UserStorage from '../../../../storage/mongodb/UserStorage';

const EP_IDENTIFIER = 'tokens';
const MODULE_NAME = 'CPOTokensEndpoint';

/**
 * CPO Tokens Endpoint
 */
export default class CPOTokensEndpoint extends AbstractEndpoint {
  // Create OCPI Service
  constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, EP_IDENTIFIER);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'PUT':
        return this.putToken(req, res, next, tenant, ocpiEndpoint);
      case 'PATCH':
        return this.patchToken(req, res, next, tenant);
      case 'GET':
        return await this.getToken(req, res, next, tenant);
    }
  }

  /**
   * Retrieve a Token as it is stored in the CPO system.
   *
   * /tokens/{country_code}/{party_id}/{token_uid}
   *
   */
  private async getToken(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const tokenId = urlSegment.shift();
    // Retrieve token
    const token = await OCPIMapping.getToken(tenant, countryCode, partyId, tokenId);
    return OCPIUtils.success(token);
  }

  /**
   * Push new/updated Token object to the CPO.
   *
   * /tokens/{country_code}/{party_id}/{token_uid}
   */
  private async putToken(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const tokenId = urlSegment.shift();
    Logging.logDebug({
      tenantID: tenant.id,
      module: MODULE_NAME, method: 'putToken',
      message: `Updating token ${tokenId} for eMSP ${countryCode}/${partyId}`
    });
    const updatedToken = req.body as OCPIToken;
    if (!updatedToken) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'patchToken',
        errorCode: HttpStatusCodes.BAD_REQUEST,
        message: `Missing content to put token ${tokenId}`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Retrieve token
    const user = await UserStorage.getUserByTagId(tenant.id, tokenId);
    if (user) {
      const tag = user.tags.find((value) => value.id === tokenId);
      if (user.issuer) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'patchToken',
          errorCode: HttpStatusCodes.NOT_FOUND,
          message: `Invalid user found for token ${tokenId}, token issued locally`,
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
      if (tag && tag.issuer) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'patchToken',
          errorCode: HttpStatusCodes.NOT_FOUND,
          message: `Invalid user found for token ${tokenId}, token does not belongs to OCPI`,
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
      if (user.name !== OCPIUtils.buildOperatorName(countryCode, partyId)) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'patchToken',
          errorCode: HttpStatusCodes.CONFLICT,
          message: `Invalid user found for token ${tokenId}, token belongs to another partner`,
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
    }
    await OCPITokensService.updateToken(tenant.id, ocpiEndpoint, updatedToken);
    return OCPIUtils.success();
  }

  /**
   * Push new/updated Token object to the CPO.
   *
   * /tokens/{country_code}/{party_id}/{token_uid}
   */
  private async patchToken(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const tokenId = urlSegment.shift();
    Logging.logDebug({
      tenantID: tenant.id,
      module: MODULE_NAME, method: 'patchToken',
      message: `Patching token ${tokenId} for eMSP ${countryCode}/${partyId}`
    });
    const patchedTag = req.body as Partial<OCPIToken>;
    if (!patchedTag) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'patchToken',
        errorCode: HttpStatusCodes.BAD_REQUEST,
        message: `Missing content to patch token ${tokenId}`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Retrieve token
    const user = await UserStorage.getUserByTagId(tenant.id, tokenId);
    if (!user) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'patchToken',
        errorCode: HttpStatusCodes.NOT_FOUND,
        message: `No user found for token ${tokenId}`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const tag = user.tags.find((value) => value.id === tokenId);
    if (user.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'patchToken',
        errorCode: HttpStatusCodes.NOT_FOUND,
        message: `Invalid user found for token ${tokenId}, token issued locally`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    if (!tag || !tag.ocpiToken || tag.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'patchToken',
        errorCode: HttpStatusCodes.NOT_FOUND,
        message: `Invalid user found for token ${tokenId}, token does not belongs to OCPI`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    if (user.name !== OCPIUtils.buildOperatorName(countryCode, partyId)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'patchToken',
        errorCode: HttpStatusCodes.CONFLICT,
        message: `Invalid user found for token ${tokenId}, token belongs to another partner`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    let patched = false;
    if (patchedTag.valid) {
      tag.active = patchedTag.valid;
      tag.ocpiToken.valid = patchedTag.valid;
      patched = true;
    }
    if (patchedTag.whitelist) {
      tag.ocpiToken.whitelist = patchedTag.whitelist;
      patched = true;
    }
    if (patchedTag.type) {
      tag.ocpiToken.type = patchedTag.type;
      patched = true;
    }
    if (patchedTag.auth_id) {
      tag.ocpiToken.auth_id = patchedTag.auth_id;
      patched = true;
    }
    if (patchedTag.visual_number) {
      tag.ocpiToken.visual_number = patchedTag.visual_number;
      patched = true;
    }
    if (patchedTag.last_updated) {
      tag.ocpiToken.last_updated = patchedTag.last_updated;
      patched = true;
    }
    if (!patched) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'patchToken',
        errorCode: HttpStatusCodes.BAD_REQUEST,
        message: `Missing or invalid content to patch token ${tokenId}`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    await UserStorage.saveUserTag(tenant.id, user.id, tag);
    return OCPIUtils.success();
  }
}

