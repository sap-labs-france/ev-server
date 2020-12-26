import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import { OCPITokenType, OCPITokenWhitelist } from '../../../../types/ocpi/OCPIToken';

import { ActionsResponse } from '../../../../types/GlobalType';
import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import EmspOCPIClient from '../../../../client/ocpi/EmspOCPIClient';
import Logging from '../../../../utils/Logging';
import OCPIClientFactory from '../../../../client/ocpi/OCPIClientFactory';
import { OCPIRole } from '../../../../types/ocpi/OCPIRole';
import { ServerAction } from '../../../../types/Server';
import Tag from '../../../../types/Tag';
import TagSecurity from './security/TagSecurity';
import TagStorage from '../../../../storage/mongodb/TagStorage';
import TenantComponents from '../../../../types/TenantComponents';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'TagService';

export default class TagService {

  public static async handleGetTag(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const tagID = TagSecurity.filterTagRequestByID(req.query);
    // Check auth
    if (!Authorizations.canReadTag(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.TAG,
        module: MODULE_NAME, method: 'handleGetTag'
      });
    }
    UtilsService.assertIdIsProvided(action, tagID, MODULE_NAME, 'handleGetTag', req.user);
    // Get the tag
    const tag = await TagStorage.getTag(req.user.tenantID, tagID, { withUser: true },
      [
        'id', 'issuer', 'description', 'active', 'default',
        'userID', 'user.id', 'user.name', 'user.firstName', 'user.email'
      ]
    );
    UtilsService.assertObjectExists(action, tag, `Tag with ID '${tagID}' does not exist`,
      MODULE_NAME, 'handleGetTag', req.user);
    // Check Users
    if (!Authorizations.canReadUser(req.user, tag.userID)) {
      delete tag.userID;
      delete tag.user;
    }
    // Return
    res.json(tag);
    next();
  }

  public static async handleGetTags(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTags(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.TAGS,
        module: MODULE_NAME, method: 'handleGetTags'
      });
    }
    // Check Users
    let userProject: string[] = [];
    if (Authorizations.canListUsers(req.user)) {
      userProject = [
        'userID', 'user.id', 'user.name', 'user.firstName', 'user.email',
        'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName'
      ];
    }
    // Filter
    const filteredRequest = TagSecurity.filterTagsRequest(req.query);
    let userID: string;
    if (Authorizations.isBasic(req.user)) {
      userID = req.user.id;
    } else {
      userID = filteredRequest.UserID;
    }
    // Get the tags
    const tags = await TagStorage.getTags(req.user.tenantID,
      {
        search: filteredRequest.Search,
        userIDs: userID ? userID.split('|') : null,
        issuer: filteredRequest.Issuer,
        active: filteredRequest.Active,
        withUser: true,
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount },
      [
        'id', 'userID', 'active', 'ocpiToken', 'description', 'issuer', 'default',
        'createdOn', 'lastChangedOn',
        ...userProject
      ],
    );
    // Return
    res.json(tags);
    next();
  }

  public static async handleDeleteTags(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const tagsIds = TagSecurity.filterTagRequestByIDs(req.body);
    // Check auth
    if (!Authorizations.canDeleteTag(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE, entity: Entity.TAG,
        module: MODULE_NAME, method: 'canDeleteTag',
        value: tagsIds.toString()
      });
    }
    // Delete
    const result = await TagService.deleteTags(action, req.user, tagsIds);
    res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleDeleteTag(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const tagId = TagSecurity.filterTagRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, tagId, MODULE_NAME, 'handleDeleteTag', req.user);
    // Check auth
    if (!Authorizations.canDeleteTag(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE, entity: Entity.TAG,
        module: MODULE_NAME, method: 'canDeleteTag',
        value: tagId
      });
    }
    // Get Tag
    const tag = await TagStorage.getTag(req.user.tenantID, tagId, { withNbrTransactions: true, withUser: true });
    UtilsService.assertObjectExists(action, tag, `Tag ID '${tagId}' does not exist`,
      MODULE_NAME, 'handleDeleteTag', req.user);
    // Only current organizations tags can be deleted
    if (!tag.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Tag ID '${tag.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleDeleteTag',
        user: req.user,
        action: action
      });
    }
    // Has transactions
    if (tag.transactionsCount > 0) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.TAG_HAS_TRANSACTIONS,
        message: `Cannot delete Tag ID '${tag.id}' which has '${tag.transactionsCount}' transaction(s)`,
        module: MODULE_NAME, method: 'handleDeleteTag',
        user: req.user,
        action: action
      });
    }
    // Delete the Tag
    await TagStorage.deleteTag(req.user.tenantID, tag.id);
    // Check if default deleted?
    if (tag.default) {
      // Clear all default
      await TagStorage.clearDefaultUserTag(req.user.tenantID, tag.userID);
      // Make the next active Tag the new default one
      const firstActiveTag = await TagStorage.getFirstActiveUserTag(req.user.tenantID, tag.userID, {
        issuer: true,
      });
      if (firstActiveTag) {
        // Set default
        firstActiveTag.default = true;
        await TagStorage.saveTag(req.user.tenantID, firstActiveTag);
      }
    }
    // OCPI
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.OCPI)) {
      try {
        const tenant = await TenantStorage.getTenant(req.user.tenantID);
        const ocpiClient: EmspOCPIClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.EMSP) as EmspOCPIClient;
        if (ocpiClient) {
          await ocpiClient.pushToken({
            uid: tag.id,
            type: OCPITokenType.RFID,
            auth_id: tag.userID,
            visual_number: tag.userID,
            issuer: tenant.name,
            valid: false,
            whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
            last_updated: new Date()
          });
        }
      } catch (error) {
        Logging.logError({
          tenantID: req.user.tenantID,
          module: MODULE_NAME, method: 'handleDeleteTag',
          action: action,
          message: `Unable to synchronize tokens of user ${tag.userID} with IOP`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteTag',
      message: `Tag '${tag.id}' has been deleted successfully`,
      action: action,
      detailedMessages: { tag }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleCreateTag(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check
    if (!Authorizations.canCreateTag(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE, entity: Entity.TAG,
        module: MODULE_NAME, method: 'handleCreateTag'
      });
    }
    // Filter
    const filteredRequest = TagSecurity.filterTagCreateRequest(req.body, req.user);
    // Check
    await UtilsService.checkIfUserTagIsValid(filteredRequest, req);
    // Check Tag
    const tag = await TagStorage.getTag(req.user.tenantID, filteredRequest.id.toUpperCase());
    if (tag) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.TAG_ALREADY_EXIST_ERROR,
        message: `Tag with ID '${filteredRequest.id}' already exists`,
        module: MODULE_NAME, method: 'handleCreateTag',
        user: req.user,
        action: action
      });
    }
    // Check User
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.userID);
    UtilsService.assertObjectExists(action, user, `User ID '${filteredRequest.userID}' does not exist`,
      MODULE_NAME, 'handleCreateTag', req.user);
    // Only current organization User can be assigned to Tag
    if (!user.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User not issued by the organization cannot be assigned to Tag ID '${tag.id}'`,
        module: MODULE_NAME, method: 'handleCreateTag',
        user: req.user, actionOnUser: user,
        action: action
      });
    }
    // Clear default tag
    if (filteredRequest.default) {
      await TagStorage.clearDefaultUserTag(req.user.tenantID, filteredRequest.userID);
    }
    // Check default Tag
    if (!filteredRequest.default) {
      // Check if another one is the default
      const defaultTag = await TagStorage.getDefaultUserTag(req.user.tenantID, filteredRequest.userID, {
        issuer: true,
      });
      if (!defaultTag) {
        // Force default Tag
        filteredRequest.default = true;
      }
    }
    // Create
    const newTag: Tag = {
      id: filteredRequest.id.toUpperCase(),
      description: filteredRequest.description,
      issuer: true,
      active: filteredRequest.active,
      createdBy: { id: req.user.id },
      createdOn: new Date(),
      userID: filteredRequest.userID,
      default: filteredRequest.default,
    } as Tag;
    // Save
    await TagStorage.saveTag(req.user.tenantID, newTag);
    // Synchronize badges with IOP
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.OCPI)) {
      try {
        const tenant = await TenantStorage.getTenant(req.user.tenantID);
        const ocpiClient: EmspOCPIClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.EMSP) as EmspOCPIClient;
        if (ocpiClient) {
          await ocpiClient.pushToken({
            uid: newTag.id,
            type: OCPITokenType.RFID,
            auth_id: newTag.userID,
            visual_number: newTag.userID,
            issuer: tenant.name,
            valid: true,
            whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
            last_updated: new Date()
          });
        }
      } catch (error) {
        Logging.logError({
          tenantID: req.user.tenantID,
          action: action,
          module: MODULE_NAME, method: 'handleCreateTag',
          message: `Unable to synchronize tokens of user ${filteredRequest.userID} with IOP`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      action: action,
      user: req.user, actionOnUser: user,
      module: MODULE_NAME, method: 'handleCreateTag',
      message: `Tag with ID '${newTag.id}'has been created successfully`,
      detailedMessages: { tag: newTag }
    });
    res.json(Object.assign({ id: newTag.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateTag(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check
    if (!Authorizations.canUpdateTag(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.TAG,
        module: MODULE_NAME, method: 'handleUpdateTag'
      });
    }
    // Filter
    const filteredRequest = TagSecurity.filterTagUpdateRequest(req.body, req.user);
    let formerTagUserID: string;
    let formerTagDefault: boolean;
    // Check
    await UtilsService.checkIfUserTagIsValid(filteredRequest, req);
    // Get Tag
    const tag = await TagStorage.getTag(req.user.tenantID, filteredRequest.id, { withNbrTransactions: true, withUser: true });
    UtilsService.assertObjectExists(action, tag, `Tag ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateTag', req.user);
    // Only current organization Tag can be updated
    if (!tag.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Tag ID '${tag.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleUpdateTag',
        user: req.user
      });
    }
    // Get User
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.userID);
    UtilsService.assertObjectExists(action, user, `User ID '${filteredRequest.userID}' does not exist`,
      MODULE_NAME, 'handleUpdateTag', req.user);
    // Only current organization User can be assigned to Tag
    if (!user.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User not issued by the organization cannot be assigned to Tag ID '${tag.id}'`,
        module: MODULE_NAME, method: 'handleUpdateTag',
        user: req.user, actionOnUser: user,
        action: action
      });
    }
    // Check User reassignment
    if (tag.userID !== filteredRequest.userID) {
      // Has transactions
      if (tag.transactionsCount > 0) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.TAG_HAS_TRANSACTIONS,
          message: `Cannot change the User of the Tag ID '${tag.id}' which has '${tag.transactionsCount}' transaction(s)`,
          module: MODULE_NAME, method: 'handleUpdateTag',
          user: req.user,
          action: action
        });
      }
      formerTagUserID = tag.userID;
      formerTagDefault = tag.default;
    }
    if (filteredRequest.default && !formerTagUserID && (tag.default !== filteredRequest.default)) {
      await TagStorage.clearDefaultUserTag(req.user.tenantID, filteredRequest.userID);
    }
    // Check default Tag
    if (!filteredRequest.default) {
      // Check if another one is the default
      const defaultTag = await TagStorage.getDefaultUserTag(req.user.tenantID, filteredRequest.userID, {
        issuer: true,
      });
      if (!defaultTag) {
        // Force default Tag
        filteredRequest.default = true;
      }
    }
    // Update
    tag.description = filteredRequest.description;
    tag.active = filteredRequest.active;
    tag.userID = filteredRequest.userID;
    tag.default = filteredRequest.default;
    tag.lastChangedBy = { id: req.user.id };
    tag.lastChangedOn = new Date();
    // Save
    await TagStorage.saveTag(req.user.tenantID, tag);
    // Check former owner of the tag
    if (formerTagUserID && formerTagDefault) {
      // Clear
      await TagStorage.clearDefaultUserTag(req.user.tenantID, formerTagUserID);
      // Check default tag
      const activeTag = await TagStorage.getFirstActiveUserTag(req.user.tenantID, formerTagUserID, {
        issuer: true
      });
      // Set default
      if (activeTag) {
        activeTag.default = true;
        await TagStorage.saveTag(req.user.tenantID, activeTag);
      }
    }
    // Synchronize badges with IOP
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.OCPI) && (filteredRequest.userID !== tag.userID)) {
      try {
        const tenant = await TenantStorage.getTenant(req.user.tenantID);
        const ocpiClient: EmspOCPIClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.EMSP) as EmspOCPIClient;
        if (ocpiClient) {
          await ocpiClient.pushToken({
            uid: tag.id,
            type: OCPITokenType.RFID,
            auth_id: tag.userID,
            visual_number: tag.userID,
            issuer: tenant.name,
            valid: tag.active,
            whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
            last_updated: new Date()
          });
        }
      } catch (error) {
        Logging.logError({
          tenantID: req.user.tenantID,
          action: action,
          module: MODULE_NAME, method: 'handleUpdateTag',
          user: req.user, actionOnUser: user,
          message: `Unable to synchronize tokens of user ${filteredRequest.userID} with IOP`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      action: action,
      module: MODULE_NAME, method: 'handleUpdateTag',
      message: `Tag with ID '${tag.id}'has been updated successfully`,
      user: req.user, actionOnUser: user,
      detailedMessages: { tag: tag }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static async deleteTags(action: ServerAction, loggedUser: UserToken, tagsIDs: string[]): Promise<ActionsResponse> {
    const result: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    for (const tagID of tagsIDs) {
      // Get Tag
      const tag = await TagStorage.getTag(loggedUser.tenantID, tagID, { withNbrTransactions: true, withUser: true });
      // Not Found
      if (!tag) {
        result.inError++;
        Logging.logError({
          tenantID: loggedUser.tenantID,
          user: loggedUser,
          module: MODULE_NAME, method: 'handleDeleteTags',
          message: `Tag ID '${tagID}' does not exist`,
          action: action,
          detailedMessages: { tag }
        });
      } else if (!tag.issuer) {
        result.inError++;
        Logging.logError({
          tenantID: loggedUser.tenantID,
          user: loggedUser,
          module: MODULE_NAME, method: 'handleDeleteTags',
          message: `Tag ID '${tag.id}' not issued by the organization`,
          action: action,
          detailedMessages: { tag }
        });
      } else if (tag.transactionsCount > 0) {
        result.inError++;
        Logging.logError({
          tenantID: loggedUser.tenantID,
          user: loggedUser,
          module: MODULE_NAME, method: 'handleDeleteTags',
          message: `Cannot delete Tag ID '${tag.id}' which has '${tag.transactionsCount}' transaction(s)`,
          action: action,
          detailedMessages: { tag }
        });
      } else {
        // Delete the Tag
        await TagStorage.deleteTag(loggedUser.tenantID, tag.id);
        result.inSuccess++;
        // Check if default deleted?
        if (tag.default) {
          // Clear all default
          await TagStorage.clearDefaultUserTag(loggedUser.tenantID, tag.userID);
          // Make the next active Tag the new default one
          const firstActiveTag = await TagStorage.getFirstActiveUserTag(loggedUser.tenantID, tag.userID, {
            issuer: true,
          });
          if (firstActiveTag) {
            // Set default
            firstActiveTag.default = true;
            await TagStorage.saveTag(loggedUser.tenantID, firstActiveTag);
          }
        }
        // OCPI
        if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.OCPI)) {
          try {
            const tenant = await TenantStorage.getTenant(loggedUser.tenantID);
            const ocpiClient: EmspOCPIClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.EMSP) as EmspOCPIClient;
            if (ocpiClient) {
              await ocpiClient.pushToken({
                uid: tag.id,
                type: OCPITokenType.RFID,
                auth_id: tag.userID,
                visual_number: tag.userID,
                issuer: tenant.name,
                valid: false,
                whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
                last_updated: new Date()
              });
            }
          } catch (error) {
            Logging.logError({
              tenantID: loggedUser.tenantID,
              module: MODULE_NAME, method: 'handleDeleteTags',
              action: action,
              message: `Unable to synchronize tokens of user ${tag.userID} with IOP`,
              detailedMessages: { error: error.message, stack: error.stack }
            });
          }
        }
      }
    }
    // Log
    Logging.logActionsResponse(loggedUser.tenantID,
      ServerAction.TAGS_DELETE,
      MODULE_NAME, 'handleDeleteTags', result,
      '{{inSuccess}} tag(s) were successfully deleted',
      '{{inError}} tag(s) failed to be deleted',
      '{{inSuccess}} tag(s) were successfully deleted and {{inError}} failed to be deleted',
      'No tags have been deleted'
    );
    return result;
  }
}
