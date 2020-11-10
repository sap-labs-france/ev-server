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

  public static async updateToken(tenantId: string, ocpiEndpoint: OCPIEndpoint, token: OCPIToken): Promise<void> {
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
    // Build user email
    const email = OCPIUtils.buildEmspEmailFromOCPIToken(token, ocpiEndpoint.countryCode, ocpiEndpoint.partyId);
    // Get User
    let user = await UserStorage.getUserByEmail(tenantId, email);
    if (user) {
      // Existing User: Check local organization
      if (user.issuer) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'updateToken',
          errorCode: StatusCodes.CONFLICT,
          message: 'Token already assigned to an internal user',
          actionOnUser: user,
          detailedMessages: { token },
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
      // Check the tag
      await this.checkExistingTag(tenantId, token);
      await UserStorage.saveTag(tenantId, {
        id: token.uid,
        issuer: false,
        userID: user.id,
        active: token.valid === true ? true : false,
        description: token.visual_number,
        lastChangedOn: token.last_updated,
        ocpiToken: token
      });
    } else {
      // Unknown User
      // Check the Tag
      await this.checkExistingTag(tenantId, token);
      // Create User
      user = {
        issuer: false,
        createdOn: token.last_updated,
        lastChangedOn: token.last_updated,
        name: token.issuer,
        firstName: OCPIUtils.buildOperatorName(ocpiEndpoint.countryCode, ocpiEndpoint.partyId),
        email: email,
        locale: Utils.getLocaleFromLanguage(token.language),
      } as User;
      // Save User
      user.id = await UserStorage.saveUser(tenantId, user);
      await UserStorage.saveUserRole(tenantId, user.id, UserRole.BASIC);
      await UserStorage.saveUserStatus(tenantId, user.id, UserStatus.ACTIVE);
      // Save Tag
      await UserStorage.saveTag(tenantId, {
        id: token.uid,
        issuer: false,
        userID: user.id,
        active: token.valid === true ? true : false,
        description: token.visual_number,
        lastChangedOn: token.last_updated,
        ocpiToken: token
      });
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

  private static async checkExistingTag(tenantId: string, token: OCPIToken): Promise<void> {
    const tag = await UserStorage.getTag(tenantId, token.uid);
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
  }
}
