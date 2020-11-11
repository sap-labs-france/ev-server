import User, { UserRole, UserStatus } from '../../../../types/User';

import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import { OCPIStatusCode } from '../../../../types/ocpi/OCPIStatusCode';
import { OCPIToken } from '../../../../types/ocpi/OCPIToken';
import OCPIUtils from '../../OCPIUtils';
import { StatusCodes } from 'http-status-codes';
import Tag from '../../../../types/Tag';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import Utils from '../../../../utils/Utils';

const MODULE_NAME = 'OCPITokensService';

export default class OCPITokensService {

  public static async updateToken(tenantId: string, ocpiEndpoint: OCPIEndpoint, token: OCPIToken, tag: Tag, emspUser: User): Promise<void> {
    if (!OCPITokensService.validateToken(token)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'updateToken',
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Token object is invalid',
        detailedMessages: { token },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    if (emspUser) {
      // Existing User: Check local organization
      if (emspUser.issuer) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'updateToken',
          errorCode: StatusCodes.CONFLICT,
          message: 'Token already assigned to an internal user',
          actionOnUser: emspUser,
          detailedMessages: { token },
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
      // Check the tag
      if (tag && tag.issuer) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'checkExistingTag',
          errorCode: StatusCodes.CONFLICT,
          message: 'Token already exists in the current organization',
          detailedMessages: token,
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
      const tagToSave = {
        id: token.uid,
        issuer: false,
        userID: emspUser.id,
        active: token.valid === true ? true : false,
        description: token.visual_number,
        lastChangedOn: token.last_updated,
        ocpiToken: token
      };
      // Save Tag
      if (!tag || JSON.stringify(tagToSave.ocpiToken) !== JSON.stringify(tag.ocpiToken)) {
        await UserStorage.saveTag(tenantId, tagToSave);
      }
    } else {
      // Unknown User
      // Check the Tag
      if (tag && tag.issuer) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'checkExistingTag',
          errorCode: StatusCodes.CONFLICT,
          message: 'Token already exists in the current organization',
          detailedMessages: token,
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
      // Create User
      emspUser = {
        issuer: false,
        createdOn: token.last_updated,
        lastChangedOn: token.last_updated,
        name: token.issuer,
        firstName: OCPIUtils.buildOperatorName(ocpiEndpoint.countryCode, ocpiEndpoint.partyId),
        email: OCPIUtils.buildEmspEmailFromOCPIToken(token, ocpiEndpoint.countryCode, ocpiEndpoint.partyId),
        locale: Utils.getLocaleFromLanguage(token.language),
      } as User;
      // Save User
      emspUser.id = await UserStorage.saveUser(tenantId, emspUser);
      await UserStorage.saveUserRole(tenantId, emspUser.id, UserRole.BASIC);
      await UserStorage.saveUserStatus(tenantId, emspUser.id, UserStatus.ACTIVE);
      const tagToSave = {
        id: token.uid,
        issuer: false,
        userID: emspUser.id,
        active: token.valid === true ? true : false,
        description: token.visual_number,
        lastChangedOn: token.last_updated,
        ocpiToken: token
      };
      // Save Tag
      if (!tag || JSON.stringify(tagToSave.ocpiToken) !== JSON.stringify(tag.ocpiToken)) {
        await UserStorage.saveTag(tenantId, tagToSave);
      }
    }
  }

  public static validateToken(token: OCPIToken): boolean {
    if (!token.uid ||
        !token.auth_id ||
        !token.type ||
        !token.issuer ||
        !token.whitelist ||
        !token.last_updated) {
      return false;
    }
    return true;
  }
}
