import { NextFunction, Request, Response } from 'express';

import AppError from '../../../../../exception/AppError';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import { OCPIToken } from '../../../../../types/ocpi/OCPIToken';
import OCPIUtils from '../../../OCPIUtils';
import OCPIUtilsService from '../../OCPIUtilsService';
import { ServerAction } from '../../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import TagStorage from '../../../../../storage/mongodb/TagStorage';
import Tenant from '../../../../../types/Tenant';

const MODULE_NAME = 'CPOTokensService';

export default class CPOTokensService {
  public static async handleGetToken(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant } = req;
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const tokenId = urlSegment.shift();
    if (!tokenId) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleGetToken', action,
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Token ID is not provided',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Retrieve token
    const token = await CPOTokensService.getToken(tenant, countryCode, partyId, tokenId);
    if (!token) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleGetToken', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `Token ID '${tokenId}' not found`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    res.json(OCPIUtils.success(token));
    next();
  }

  public static async handlePutToken(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant } = req;
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const tokenId = urlSegment.shift();
    if (!tokenId) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePutToken', action,
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Token ID is not provided',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const token = req.body as OCPIToken;
    if (!token) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePutToken', action,
        errorCode: StatusCodes.BAD_REQUEST,
        message: `Missing content to put Token ID '${tokenId}'`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Retrieve token
    const tag = await TagStorage.getTag(tenant, tokenId, { withUser: true });
    if (!tag) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePutToken', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `Token ID '${tokenId}' not found`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR,
        detailedMessages: { token }
      });
    }
    if (tag.issuer) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePutToken', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `Token ID '${tokenId}' is local to the tenant`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR,
        detailedMessages: { token, tag }
      });
    }
    if (tag.user?.issuer) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePutToken', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `User found for Token ID '${tokenId}' is local to the tenant`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR,
        detailedMessages: { token, tag }
      });
    }
    const operator = OCPIUtils.buildOperatorName(countryCode, partyId);
    if (tag.user.name !== operator) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePutToken', action,
        errorCode: StatusCodes.CONFLICT,
        message: `${operator} is not the owner of the Token ID '${tokenId}'`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR,
        detailedMessages: { operator, token, tag }
      });
    }
    await OCPIUtilsService.updateCreateTagWithEmspToken(tenant, token, tag, tag.user, ServerAction.OCPI_CPO_UPDATE_TOKEN);
    res.json(OCPIUtils.success());
    next();
  }

  public static async handlePatchToken(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant } = req;
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const tokenId = urlSegment.shift();
    const token = req.body as OCPIToken;
    if (!token) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePatchToken', action,
        errorCode: StatusCodes.BAD_REQUEST,
        message: `Missing content to patch Token ID '${tokenId}'`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Retrieve token
    const tag = await TagStorage.getTag(tenant, tokenId, { withUser: true });
    if (!tag?.ocpiToken || tag?.issuer) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePatchToken', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `Token ID '${tokenId}' is local to the tenant`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR,
        detailedMessages: { tag, token }
      });
    }
    if (!tag.user) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePatchToken', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `Token ID '${tokenId}' is not assigned to a user`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR,
        detailedMessages: { tag, token }
      });
    }
    if (tag.user.issuer) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePatchToken', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `Token ID '${tokenId}' is assigned to a user that belongs to the local tenant`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR,
        detailedMessages: { user: tag.user, tag, token }
      });
    }
    const operator = OCPIUtils.buildOperatorName(countryCode, partyId);
    if (tag.user.name !== operator) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePatchToken', action,
        errorCode: StatusCodes.CONFLICT,
        message: `${operator} is not the owner of the Token ID '${tokenId}'`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR,
        detailedMessages: { operator, user: tag.user, tag, token }
      });
    }
    let patched = false;
    if (token.valid) {
      tag.active = token.valid;
      tag.ocpiToken.valid = token.valid;
      patched = true;
    }
    if (token.whitelist) {
      tag.ocpiToken.whitelist = token.whitelist;
      patched = true;
    }
    if (token.type) {
      tag.ocpiToken.type = token.type;
      patched = true;
    }
    if (token.auth_id) {
      tag.ocpiToken.auth_id = token.auth_id;
      patched = true;
    }
    if (token.visual_number) {
      tag.ocpiToken.visual_number = token.visual_number;
      patched = true;
    }
    if (token.last_updated) {
      tag.ocpiToken.last_updated = token.last_updated;
      patched = true;
    }
    if (!patched) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePatchToken', action,
        errorCode: StatusCodes.BAD_REQUEST,
        message: `Missing or invalid content to patch Token ID '${tokenId}'`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    tag.userID = tag.user.id;
    await TagStorage.saveTag(tenant, tag);
    res.json(OCPIUtils.success());
    next();
  }

  private static async getToken(tenant: Tenant, countryId: string, partyId: string, tokenId: string): Promise<OCPIToken> {
    const tag = await TagStorage.getTag(tenant, tokenId, { withUser: true });
    if (tag?.user) {
      if (!tag.user.issuer && tag.user.name === OCPIUtils.buildOperatorName(countryId, partyId) && tag.ocpiToken) {
        return tag.ocpiToken;
      }
    }
  }
}
