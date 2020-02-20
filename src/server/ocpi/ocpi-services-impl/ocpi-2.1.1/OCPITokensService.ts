import UserStorage from '../../../../storage/mongodb/UserStorage';
import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import HttpStatusCodes from 'http-status-codes';
import { OCPIToken } from '../../../../types/ocpi/OCPIToken';
import User, { Status } from '../../../../types/User';
import OCPIMapping from './OCPIMapping';
import { Role } from '../../../../types/Authorization';
import OCPIUtils from '../../OCPIUtils';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import { OCPIStatusCode } from '../../../../types/ocpi/OCPIStatusCode';

const MODULE_NAME = 'EMSPTokensEndpoint';

export default class OCPITokensService {

  public static async updateToken(tenantId: string, ocpiEndpoint: OCPIEndpoint, token: OCPIToken): Promise<void> {
    if (!OCPITokensService.validateToken(token)) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'updateToken',
        errorCode: HttpStatusCodes.BAD_REQUEST,
        message: 'Token object is invalid',
        detailedMessages: token,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const email = OCPIUtils.buildUserEmailFromOCPIToken(token, ocpiEndpoint.countryCode, ocpiEndpoint.partyId);
    let user = await UserStorage.getUserByEmail(tenantId, email);
    if (user) {
      const tag = user.tags.find((value) => value.id === token.uid);
      if (tag) {
        if (tag.issuer) {
          throw new AppError({
            source: Constants.OCPI_SERVER,
            module: MODULE_NAME,
            method: 'updateToken',
            errorCode: HttpStatusCodes.CONFLICT,
            message: `The token ${token.uid} is already assigned to internal user`,
            detailedMessages: token,
            ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
          });
        }
        tag.issuer = false;
        tag.lastChangedOn = token.last_updated;
        tag.description = token.visual_number;
        tag.deleted = token.valid === true ? false : true;
        tag.ocpiToken = token;
      } else {
        user.tags.push(
          {
            id: token.uid,
            issuer: false,
            deleted: token.valid === true ? false : true,
            description: token.visual_number,
            lastChangedOn: token.last_updated,
            ocpiToken: token
          }
        );
      }
    } else {
      user = {
        issuer: false,
        createdOn: token.last_updated,
        lastChangedOn: token.last_updated,
        name: token.issuer,
        firstName: OCPIUtils.buildOperatorName(ocpiEndpoint.countryCode, ocpiEndpoint.partyId),
        email: email,
        locale: OCPIMapping.convertLanguageToLocale(token.language),
        tags: [
          {
            id: token.uid,
            issuer: false,
            deleted: token.valid === true ? false : true,
            description: token.visual_number,
            lastChangedOn: token.last_updated,
            ocpiToken: token
          }
        ]
      } as User;
      user.id = await UserStorage.saveUser(tenantId, user);
      await UserStorage.saveUserRole(tenantId, user.id, Role.BASIC);
      await UserStorage.saveUserStatus(tenantId, user.id, Status.ACTIVE);
    }
    await UserStorage.saveUserTags(tenantId, user.id, user.tags);
  }

  private static validateToken(token: OCPIToken): boolean {
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
}
