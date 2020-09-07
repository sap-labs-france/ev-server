import User, { UserRole, UserStatus } from '../../../../types/User';

import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import HttpStatusCodes from 'http-status-codes';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import { OCPIStatusCode } from '../../../../types/ocpi/OCPIStatusCode';
import { OCPIToken } from '../../../../types/ocpi/OCPIToken';
import OCPIUtils from '../../OCPIUtils';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import Utils from '../../../../utils/Utils';

const MODULE_NAME = 'OCPITokensService';

export default class OCPITokensService {

  public static async updateToken(tenantId: string, ocpiEndpoint: OCPIEndpoint, token: OCPIToken): Promise<void> {
    if (!OCPITokensService.validateToken(token)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'updateToken',
        errorCode: HttpStatusCodes.BAD_REQUEST,
        message: 'Token object is invalid',
        detailedMessages: { token },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    const email = OCPIUtils.buildUserEmailFromOCPIToken(token, ocpiEndpoint.countryCode, ocpiEndpoint.partyId);
    let user = await UserStorage.getUserByEmail(tenantId, email);
    if (user) {
      if (user.issuer) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'updateToken',
          errorCode: HttpStatusCodes.CONFLICT,
          message: `The Token ID '${token.uid}' is already assigned to internal User`,
          detailedMessages: { token },
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
      const tag = user.tags.find((value) => value.id === token.uid);
      if (tag) {
        tag.issuer = false;
        tag.lastChangedOn = token.last_updated;
        tag.description = token.visual_number;
        tag.active = token.valid === true ? true : false;
        tag.ocpiToken = token;
        await UserStorage.saveUserTag(tenantId, user.id, tag);
      } else {
        await this.checkExistingTag(tenantId, token);
        await UserStorage.saveUserTag(tenantId, user.id, {
          id: token.uid,
          issuer: false,
          active: token.valid === true ? true : false,
          description: token.visual_number,
          lastChangedOn: token.last_updated,
          ocpiToken: token
        });
      }
    } else {
      await this.checkExistingTag(tenantId, token);
      user = {
        issuer: false,
        createdOn: token.last_updated,
        lastChangedOn: token.last_updated,
        name: token.issuer,
        firstName: OCPIUtils.buildOperatorName(ocpiEndpoint.countryCode, ocpiEndpoint.partyId),
        email: email,
        locale: Utils.getLocaleFromLanguage(token.language),
        tags: [
          {
            id: token.uid,
            issuer: false,
            active: token.valid === true ? false : true,
            description: token.visual_number,
            lastChangedOn: token.last_updated,
            ocpiToken: token
          }
        ]
      } as User;
      user.id = await UserStorage.saveUser(tenantId, user);
      await UserStorage.saveUserRole(tenantId, user.id, UserRole.BASIC);
      await UserStorage.saveUserStatus(tenantId, user.id, UserStatus.ACTIVE);
      await UserStorage.saveUserTag(tenantId, user.id, user.tags[0]);
    }
  }

  public static validateToken(token: OCPIToken): boolean {
    if (!token.uid
      || !token.auth_id
      || !token.type
      || !token.issuer
      || !token.whitelist
      || !token.last_updated
    ) {
      return false;
    }
    return true;
  }

  private static async checkExistingTag(tenantId: string, token: OCPIToken): Promise<void> {
    const existingTag = await UserStorage.getTag(tenantId, token.uid);
    if (existingTag) {
      if (existingTag.issuer) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'updateToken',
          errorCode: HttpStatusCodes.CONFLICT,
          message: `The Token ID '${token.uid}' does not belongs to OCPI`,
          detailedMessages: token,
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      } else {
        const user = await UserStorage.getUser(tenantId, existingTag.userID);
        if (!user || user.deleted) {
          await UserStorage.deleteUserTag(tenantId, existingTag.userID, existingTag);
        }
      }
    }
  }
}
