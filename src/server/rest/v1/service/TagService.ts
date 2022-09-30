import { Action, Entity } from '../../../../types/Authorization';
import { ActionsResponse, ImportStatus } from '../../../../types/GlobalType';
import { AsyncTaskType, AsyncTasks } from '../../../../types/AsyncTask';
import Busboy, { FileInfo } from 'busboy';
import { DataResult, TagDataResult } from '../../../../types/DataResult';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import Tag, { ImportedTag, TagRequiredImportProperties } from '../../../../types/Tag';
import Tenant, { TenantComponents } from '../../../../types/Tenant';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AsyncTaskBuilder from '../../../../async-task/AsyncTaskBuilder';
import AuthorizationService from './AuthorizationService';
import Authorizations from '../../../../authorization/Authorizations';
import CSVError from 'csvtojson/v2/CSVError';
import Constants from '../../../../utils/Constants';
import EmspOCPIClient from '../../../../client/ocpi/EmspOCPIClient';
import { HttpTagsGetRequest } from '../../../../types/requests/HttpTagRequest';
import { ImportedUser } from '../../../../types/User';
import JSONStream from 'JSONStream';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import OCPIClientFactory from '../../../../client/ocpi/OCPIClientFactory';
import { OCPIRole } from '../../../../types/ocpi/OCPIRole';
import { OCPITokenWhitelist } from '../../../../types/ocpi/OCPIToken';
import OCPIUtils from '../../../ocpi/OCPIUtils';
import { Readable } from 'stream';
import { ServerAction } from '../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import TagStorage from '../../../../storage/mongodb/TagStorage';
import TagValidatorRest from '../validator/TagValidatorRest';
import UserToken from '../../../../types/UserToken';
import UserValidatorRest from '../validator/UserValidatorRest';
import Utils from '../../../../utils/Utils';
import UtilsSecurity from './security/UtilsSecurity';
import UtilsService from './UtilsService';
import csvToJson from 'csvtojson/v2';

const MODULE_NAME = 'TagService';

export default class TagService {

  public static async handleGetTag(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter request
    const filteredRequest = TagValidatorRest.getInstance().validateTagGetReq(req.query);
    // Check and Get Tag
    const tag = await UtilsService.checkAndGetTagAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, { withUser: filteredRequest.WithUser }, true);
    res.json(tag);
    next();
  }

  public static async handleGetTags(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TagValidatorRest.getInstance().validateTagsGetReq(req.query);
    // Get Tags
    res.json(await TagService.getTags(req, filteredRequest));
    next();
  }

  public static async handleDeleteTags(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const tagsIDs = TagValidatorRest.getInstance().validateTagsDeleteReq(req.body).tagsIDs;
    // Delete
    const result = await TagService.deleteTags(req.tenant, action, req.user, tagsIDs);
    res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleUnassignTags(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TagValidatorRest.getInstance().validateTagsByVisualIDsUnassignReq(req.body);
    // Delete
    const result = await TagService.unassignTags(req.tenant, action, req.user, filteredRequest.visualIDs);
    res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleUnassignTag(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TagValidatorRest.getInstance().validateTagByVisualIDUnassignReq(req.body);
    // Delete
    const response = await TagService.unassignTags(req.tenant, action, req.user, [filteredRequest.visualID]);
    if (response.inSuccess === 0) {
      throw new AppError({
        action: ServerAction.TAG_UNASSIGN,
        module: MODULE_NAME, method: 'handleUnassignTag',
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Unable to unassign the Tag visualID '${filteredRequest.visualID}'`
      });
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetTagByVisualID(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter request
    const filteredRequest = TagValidatorRest.getInstance().validateTagByVisualIDGetReq(req.query);
    // Check and Get Tag
    const tag = await UtilsService.checkAndGetTagByVisualIDAuthorization(
      req.tenant, req.user, filteredRequest.VisualID, Action.READ, action, null, { withUser: filteredRequest.WithUser }, true);
    res.json(tag);
    next();
  }

  public static async handleDeleteTag(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TagValidatorRest.getInstance().validateTagDeleteReq(req.query);
    // Delete
    const response = await TagService.deleteTags(req.tenant, action, req.user, [filteredRequest.ID]);
    if (response.inSuccess === 0) {
      throw new AppError({
        action: ServerAction.TAG_DELETE,
        module: MODULE_NAME, method: 'handleDeleteTag',
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Unable to delete the Tag ID '${filteredRequest.ID}'`
      });
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleCreateTag(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TagValidatorRest.getInstance().validateTagCreateReq(req.body);
    // Get dynamic auth
    await AuthorizationService.checkAndGetTagAuthorizations(
      req.tenant, req.user, {}, Action.CREATE, filteredRequest);
    // Check Tag with ID
    let tag = await TagStorage.getTag(req.tenant, filteredRequest.id.toUpperCase());
    if (tag) {
      throw new AppError({
        ...LoggingHelper.getTagProperties(tag),
        errorCode: HTTPError.TAG_ALREADY_EXIST_ERROR,
        message: `Tag with ID '${filteredRequest.id}' already exists`,
        module: MODULE_NAME, method: 'handleCreateTag',
        user: req.user,
        action: action
      });
    }
    // Check Tag with Visual ID
    tag = await TagStorage.getTagByVisualID(req.tenant, filteredRequest.visualID);
    if (tag) {
      throw new AppError({
        ...LoggingHelper.getTagProperties(tag),
        errorCode: HTTPError.TAG_VISUAL_ID_ALREADY_EXIST_ERROR,
        message: `Tag with visual ID '${filteredRequest.visualID}' already exists`,
        module: MODULE_NAME, method: 'handleCreateTag',
        user: req.user,
        action: action
      });
    }
    if (filteredRequest.userID) {
      // Get User
      await UtilsService.checkAndGetUserAuthorization(req.tenant, req.user, filteredRequest.userID,
        Action.READ, ServerAction.TAG_CREATE);
      // Default tag?
      if (filteredRequest.default) {
        // Clear
        await TagStorage.clearDefaultUserTag(req.tenant, filteredRequest.userID);
        // Check if another one is the default
      } else {
        const defaultTag = await TagStorage.getDefaultUserTag(req.tenant, filteredRequest.userID, {
          issuer: true,
        });
        // No default tag: Force default
        if (!defaultTag) {
          filteredRequest.default = true;
        }
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
      visualID: filteredRequest.visualID
    } as Tag;
    // Save
    await TagStorage.saveTag(req.tenant, newTag);
    // OCPI
    void TagService.updateTagRoaming(action, req.tenant, req.user, newTag);
    await Logging.logInfo({
      ...LoggingHelper.getTagProperties(newTag),
      tenantID: req.tenant.id,
      action: action,
      user: req.user,
      module: MODULE_NAME, method: 'handleCreateTag',
      message: `Tag with ID '${newTag.id}'has been created successfully`,
      detailedMessages: { tag: newTag }
    });
    res.status(StatusCodes.CREATED).json(Object.assign({ id: newTag.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleAssignTag(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const filteredRequest = TagValidatorRest.getInstance().validateTagAssignReq(req.body);
    // Check and Get Tag
    const tag = await UtilsService.checkAndGetTagByVisualIDAuthorization(req.tenant, req.user, filteredRequest.visualID, Action.ASSIGN, action,
      filteredRequest, { withNbrTransactions: true, withUser: true });
    // Check Tag with Visual ID
    if (!tag) {
      throw new AppError({
        ...LoggingHelper.getTagProperties(tag),
        errorCode: HTTPError.TAG_VISUAL_ID_DOES_NOT_MATCH_TAG_ERROR,
        message: `Tag with visual ID '${filteredRequest.visualID}' does not match any badge`,
        module: MODULE_NAME, method: 'handleAssignTag',
        user: req.user,
        action: action
      });
    }
    // Check if tag is active
    if (!tag.active) {
      throw new AppError({
        ...LoggingHelper.getTagProperties(tag),
        errorCode: HTTPError.TAG_INACTIVE,
        message: `Tag with visual ID '${filteredRequest.visualID}' is not active and cannot be assigned`,
        module: MODULE_NAME, method: 'handleAssignTag',
        user: req.user,
        action: action
      });
    }
    if (tag.user) {
      throw new AppError({
        ...LoggingHelper.getTagProperties(tag),
        errorCode: HTTPError.TAG_ALREADY_EXIST_ERROR,
        message: `Tag with ID '${filteredRequest.id}' already exists and assigned to another user`,
        module: MODULE_NAME, method: 'handleAssignTag',
        user: req.user,
        action: action
      });
    }
    // Get User
    const user = await UtilsService.checkAndGetUserAuthorization(req.tenant, req.user, filteredRequest.userID,
      Action.READ, ServerAction.TAG_ASSIGN);
    // Default tag?
    if (filteredRequest.default) {
      // Clear
      await TagStorage.clearDefaultUserTag(req.tenant, filteredRequest.userID);
      // Check if another one is the default
    } else {
      const defaultTag = await TagStorage.getDefaultUserTag(req.tenant, filteredRequest.userID, {
        issuer: true,
      });
      // No default tag: Force default
      if (!defaultTag) {
        filteredRequest.default = true;
      }
    }
    tag.default = filteredRequest.default;
    tag.userID = filteredRequest.userID;
    tag.description = filteredRequest.description;
    tag.lastChangedBy = { id: req.user.id };
    tag.lastChangedOn = new Date();
    // Assign
    await TagStorage.saveTag(req.tenant, tag);
    // OCPI
    void TagService.updateTagRoaming(action, req.tenant, req.user, tag);
    await Logging.logInfo({
      ...LoggingHelper.getTagProperties(tag),
      tenantID: req.tenant.id,
      action: action,
      user: req.user, actionOnUser: user,
      module: MODULE_NAME, method: 'handleAssignTag',
      message: `Tag with ID '${tag.id}'has been created successfully`,
      detailedMessages: { tag: tag }
    });
    res.status(StatusCodes.CREATED).json(Object.assign({ id: tag.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateTagByVisualID(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TagValidatorRest.getInstance().validateTagVisualIDUpdateReq(req.body);
    // Check and Get Tag
    const tag = await UtilsService.checkAndGetTagByVisualIDAuthorization(req.tenant, req.user, filteredRequest.visualID, Action.UPDATE_BY_VISUAL_ID, action,
      filteredRequest, { withNbrTransactions: true, withUser: true });
    // Clear User's default Tag
    if (filteredRequest.default && (tag.default !== filteredRequest.default)) {
      await TagStorage.clearDefaultUserTag(req.tenant, filteredRequest.userID);
    }
    // Check default Tag existence
    if (!filteredRequest.default) {
      // Check if another one is the default
      const defaultTag = await TagStorage.getDefaultUserTag(req.tenant, filteredRequest.userID, {
        issuer: true,
      });
      // Force default Tag
      if (!defaultTag) {
        filteredRequest.default = true;
      }
    }
    // Update
    tag.description = filteredRequest.description;
    tag.default = filteredRequest.default;
    tag.lastChangedBy = { id: req.user.id };
    tag.lastChangedOn = new Date();
    // Save
    await TagStorage.saveTag(req.tenant, tag);
    void TagService.updateTagRoaming(action, req.tenant, req.user, tag);
    await Logging.logInfo({
      ...LoggingHelper.getTagProperties(tag),
      tenantID: req.tenant.id,
      action: action,
      module: MODULE_NAME, method: 'handleUpdateTagByVisualID',
      message: `Tag with ID '${tag.id}' has been updated successfully`,
      user: req.user, actionOnUser: tag.user,
      detailedMessages: { tag: tag }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateTag(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TagValidatorRest.getInstance().validateTagUpdateReq({ ...req.params, ...req.body });
    // Check and Get Tag
    const tag = await UtilsService.checkAndGetTagAuthorization(req.tenant, req.user, filteredRequest.id, Action.UPDATE, action,
      filteredRequest, { withUser: true }, true);
    if (filteredRequest.userID) {
      await UtilsService.checkAndGetUserAuthorization(req.tenant, req.user, filteredRequest.userID,
        Action.READ, ServerAction.TAG_UPDATE);
    }
    // Check visualID uniqueness
    if (tag.visualID !== filteredRequest.visualID) {
      const tagVisualID = await TagStorage.getTagByVisualID(req.tenant, filteredRequest.visualID);
      if (tagVisualID) {
        throw new AppError({
          ...LoggingHelper.getTagProperties(tag),
          errorCode: HTTPError.TAG_VISUAL_ID_ALREADY_EXIST_ERROR,
          message: `Tag with Visual ID '${filteredRequest.id}' already exists`,
          module: MODULE_NAME, method: 'handleUpdateTag',
          user: req.user,
          action: action
        });
      }
    }
    let formerTagUserID: string;
    let formerTagDefault: boolean;
    // Cannot change the User of a Badge that has already some transactions
    if (tag.userID !== filteredRequest.userID) {
      formerTagUserID = tag.userID;
      formerTagDefault = tag.default;
    }
    if (filteredRequest.userID) {
      // Clear User's default Tag
      if (filteredRequest.default) {
        await TagStorage.clearDefaultUserTag(req.tenant, filteredRequest.userID);
        // Check default Tag existence
      } else {
        // Check if another one is the default
        const defaultTag = await TagStorage.getDefaultUserTag(req.tenant, filteredRequest.userID, {
          issuer: true,
        });
        // Force default Tag
        if (!defaultTag) {
          filteredRequest.default = true;
        }
      }
    }
    // Update
    tag.visualID = filteredRequest.visualID;
    tag.description = filteredRequest.description;
    tag.active = filteredRequest.active;
    tag.userID = filteredRequest.userID;
    tag.default = filteredRequest.userID ? filteredRequest.default : false;
    tag.lastChangedBy = { id: req.user.id };
    tag.lastChangedOn = new Date();
    // Save
    await TagStorage.saveTag(req.tenant, tag);
    // Ensure former User has a default Tag
    if (formerTagUserID && formerTagDefault) {
      await TagService.setDefaultTagForUser(req.tenant, formerTagUserID);
    }
    // OCPI
    void TagService.updateTagRoaming(action, req.tenant, req.user, tag);
    await Logging.logInfo({
      ...LoggingHelper.getTagProperties(tag),
      tenantID: req.tenant.id,
      action: action,
      module: MODULE_NAME, method: 'handleUpdateTag',
      message: `Tag with ID '${tag.id}' has been updated successfully`,
      user: req.user,
      detailedMessages: { tag: tag }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }


  // eslint-disable-next-line @typescript-eslint/require-await
  public static async handleImportTags(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!(await Authorizations.canImportTags(req.user)).authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.IMPORT, entity: Entity.TAG,
        module: MODULE_NAME, method: 'handleImportTags'
      });
    }
    // Acquire the lock
    const importTagsLock = await LockingHelper.acquireImportTagsLock(req.tenant.id);
    if (!importTagsLock) {
      throw new AppError({
        action: action,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        module: MODULE_NAME, method: 'handleImportTags',
        message: 'Error in importing the Tags: cannot acquire the lock',
        user: req.user
      });
    }
    try {
      // Default values for Tag import
      const importedBy = req.user.id;
      const importedOn = new Date();
      const tagsToBeImported: ImportedTag[] = [];
      const startTime = new Date().getTime();
      const result: ActionsResponse = {
        inSuccess: 0,
        inError: 0
      };
      // Delete all previously imported tags
      await TagStorage.deleteImportedTags(req.tenant);
      // Get the stream
      const busboy = Busboy({ headers: req.headers });
      req.pipe(busboy);
      // Handle closed socket
      let connectionClosed = false;
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      req.socket.on('close', async () => {
        if (!connectionClosed) {
          connectionClosed = true;
          // Release the lock
          await LockingManager.release(importTagsLock);
        }
      });
      await new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        busboy.on('file', async (fileName: string, fileStream: Readable, fileInfo: FileInfo) => {
          if (fileInfo.filename.slice(-4) === '.csv') {
            const converter = csvToJson({
              trim: true,
              delimiter: Constants.CSV_SEPARATOR,
              output: 'json',
            });
            void converter.subscribe(async (tag: ImportedTag) => {
              // Check connection
              if (connectionClosed) {
                reject(new Error('HTTP connection has been closed'));
              }
              // Check the format of the first entry
              if (!result.inSuccess && !result.inError) {
                // Check header
                const tagKeys = Object.keys(tag);
                if (!TagRequiredImportProperties.every((property) => tagKeys.includes(property))) {
                  if (!res.headersSent) {
                    res.writeHead(HTTPError.INVALID_FILE_CSV_HEADER_FORMAT);
                    res.end();
                    resolve();
                  }
                  reject(new Error(`Missing one of required properties: '${TagRequiredImportProperties.join(', ')}'`));
                }
              }
              // Set default value
              tag.importedBy = importedBy;
              tag.importedOn = importedOn;
              tag.importedData = {
                'autoActivateUserAtImport': UtilsSecurity.filterBoolean(req.headers.autoactivateuseratimport),
                'autoActivateTagAtImport': UtilsSecurity.filterBoolean(req.headers.autoactivatetagatimport)
              };
              // Import
              const importSuccess = await TagService.processTag(action, req, tag, tagsToBeImported);
              if (!importSuccess) {
                result.inError++;
              }
              // Insert batched
              if (!Utils.isEmptyArray(tagsToBeImported) && (tagsToBeImported.length % Constants.IMPORT_BATCH_INSERT_SIZE) === 0) {
                await TagService.insertTags(req.tenant, req.user, action, tagsToBeImported, result);
              }
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            }, async (error: CSVError) => {
              // Release the lock
              await LockingManager.release(importTagsLock);
              await Logging.logError({
                tenantID: req.tenant.id,
                module: MODULE_NAME, method: 'handleImportTags',
                action: action,
                user: req.user.id,
                message: `Exception while parsing the CSV '${fileInfo.filename}': ${error.message}`,
                detailedMessages: { error: error.stack }
              });
              if (!res.headersSent) {
                res.writeHead(HTTPError.INVALID_FILE_FORMAT);
                res.end();
                resolve();
              }
            // Completed
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            }, async () => {
              // Consider the connection closed
              connectionClosed = true;
              // Insert batched
              if (tagsToBeImported.length > 0) {
                await TagService.insertTags(req.tenant, req.user, action, tagsToBeImported, result);
              }
              // Release the lock
              await LockingManager.release(importTagsLock);
              const executionDurationSecs = Utils.truncTo((new Date().getTime() - startTime) / 1000, 2);
              await Logging.logActionsResponse(
                req.tenant.id, action,
                MODULE_NAME, 'handleImportTags', result,
                `{{inSuccess}} Tag(s) were successfully uploaded in ${executionDurationSecs}s and ready for asynchronous import`,
                `{{inError}} Tag(s) failed to be uploaded in ${executionDurationSecs}s`,
                `{{inSuccess}}  Tag(s) were successfully uploaded in ${executionDurationSecs}s and ready for asynchronous import and {{inError}} failed to be uploaded`,
                `No Tag have been uploaded in ${executionDurationSecs}s`, req.user
              );
              // Create and Save async task
              await AsyncTaskBuilder.createAndSaveAsyncTasks({
                name: AsyncTasks.TAGS_IMPORT,
                action: ServerAction.TAGS_IMPORT,
                type: AsyncTaskType.TASK,
                tenantID: req.tenant.id,
                module: MODULE_NAME,
                method: 'handleImportTags',
              });
              // Respond
              if (!res.headersSent) {
                res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
              }
              next();
              resolve();
            });
            // Start processing the file
            void fileStream.pipe(converter);
          } else if (fileInfo.encoding === 'application/json') {
            const parser = JSONStream.parse('tags.*');
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            parser.on('data', async (tag: ImportedTag) => {
              // Set default value
              tag.importedBy = importedBy;
              tag.importedOn = importedOn;
              // Import
              const importSuccess = await TagService.processTag(action, req, tag, tagsToBeImported);
              if (!importSuccess) {
                result.inError++;
              }
              // Insert batched
              if ((tagsToBeImported.length % Constants.IMPORT_BATCH_INSERT_SIZE) === 0) {
                await TagService.insertTags(req.tenant, req.user, action, tagsToBeImported, result);
              }
            });
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            parser.on('error', async (error) => {
              // Release the lock
              await LockingManager.release(importTagsLock);
              await Logging.logError({
                tenantID: req.tenant.id,
                module: MODULE_NAME, method: 'handleImportTags',
                action: action,
                user: req.user.id,
                message: `Invalid Json file '${fileInfo.filename}'`,
                detailedMessages: { error: error.stack }
              });
              if (!res.headersSent) {
                res.writeHead(HTTPError.INVALID_FILE_FORMAT);
                res.end();
                resolve();
              }
            });
            fileStream.pipe(parser);
          } else {
            // Release the lock
            await LockingManager.release(importTagsLock);
            await Logging.logError({
              tenantID: req.tenant.id,
              module: MODULE_NAME, method: 'handleImportTags',
              action: action,
              user: req.user.id,
              message: `Invalid file format '${fileInfo.mimeType}'`
            });
            if (!res.headersSent) {
              res.writeHead(HTTPError.INVALID_FILE_FORMAT);
              res.end();
              resolve();
            }
          }
        });
      });
    } finally {
      // Release the lock
      await LockingManager.release(importTagsLock);
    }
  }

  public static async handleExportTags(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!(await Authorizations.canExportTags(req.user)).authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.EXPORT, entity: Entity.TAG,
        module: MODULE_NAME, method: 'handleExportTags'
      });
    }
    // Force params
    req.query.Limit = Constants.EXPORT_PAGE_SIZE.toString();
    // Filter
    const filteredRequest = TagValidatorRest.getInstance().validateTagsGetReq(req.query);
    // Export
    await UtilsService.exportToCSV(req, res, 'exported-tags.csv', filteredRequest,
      TagService.getTags.bind(this),
      TagService.convertToCSV.bind(this));
  }

  private static async insertTags(tenant: Tenant, user: UserToken, action: ServerAction, tagsToBeImported: ImportedTag[], result: ActionsResponse): Promise<void> {
    try {
      const nbrInsertedTags = await TagStorage.saveImportedTags(tenant, tagsToBeImported);
      result.inSuccess += nbrInsertedTags;
    } catch (error) {
      // Handle dup keys
      result.inSuccess += error.result.nInserted;
      result.inError += error.writeErrors.length;
      await Logging.logError({
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'insertTags',
        action: action,
        user: user.id,
        message: `Cannot import ${error.writeErrors.length as number} tags!`,
        detailedMessages: { error: error.stack, tagsError: error.writeErrors }
      });
    }
    tagsToBeImported.length = 0;
  }

  private static async deleteTags(tenant: Tenant, action: ServerAction, loggedUser: UserToken, tagsIDs: string[]): Promise<ActionsResponse> {
    const result: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    // Delete Tags
    for (const tagID of tagsIDs) {
      try {
        // Check and Get Tag
        const tag = await UtilsService.checkAndGetTagAuthorization(
          tenant, loggedUser, tagID, Action.DELETE, action, null, {}, true);
        // Delete OCPI
        void TagService.checkAndDeleteTagRoaming(tenant, loggedUser, tag);
        // Delete the Tag
        await TagStorage.deleteTag(tenant, tag.id);
        result.inSuccess++;
        // Ensure User has a default Tag
        if (tag.default) {
          await TagService.setDefaultTagForUser(tenant, tag.userID);
        }
      } catch (error) {
        result.inError++;
        await Logging.logError({
          tenantID: tenant.id,
          module: MODULE_NAME, method: 'deleteTags',
          action: ServerAction.TAG_DELETE,
          message: `Unable to delete the Tag ID '${tagID}'`,
          detailedMessages: { error: error.stack }
        });
      }
    }
    await Logging.logActionsResponse(loggedUser.tenantID,
      ServerAction.TAGS_DELETE,
      MODULE_NAME, 'handleDeleteTags', result,
      '{{inSuccess}} tag(s) were successfully deleted',
      '{{inError}} tag(s) failed to be deleted',
      '{{inSuccess}} tag(s) were successfully deleted and {{inError}} failed to be deleted',
      'No tags have been deleted', loggedUser
    );
    return result;
  }

  private static async unassignTags(tenant: Tenant, action: ServerAction, loggedUser: UserToken, visualIDs: string[]): Promise<ActionsResponse> {
    const result: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    // Delete Tags
    for (const visualID of visualIDs) {
      try {
        // Check and Get Tag
        const tag = await UtilsService.checkAndGetTagByVisualIDAuthorization(
          tenant, loggedUser, visualID, Action.UNASSIGN, action, null, {});
        // Delete OCPI
        void TagService.checkAndDeleteTagRoaming(tenant, loggedUser, tag);
        // Unassign the Tag
        const userID = tag.userID;
        tag.userID = null;
        tag.active = false;
        await TagStorage.saveTag(tenant, tag);
        result.inSuccess++;
        // Ensure User has a default Tag
        if (tag.default) {
          await TagService.setDefaultTagForUser(tenant, userID);
        }
      } catch (error) {
        result.inError++;
        await Logging.logError({
          tenantID: tenant.id,
          module: MODULE_NAME, method: 'unassignTags',
          action: ServerAction.TAG_DELETE,
          message: `Unable to unassign the Tag with visual ID '${visualID}'`,
          detailedMessages: { error: error.stack }
        });
      }
    }
    await Logging.logActionsResponse(loggedUser.tenantID,
      ServerAction.TAGS_DELETE,
      MODULE_NAME, 'unassignTags', result,
      '{{inSuccess}} tag(s) were successfully unassigned',
      '{{inError}} tag(s) failed to be unassigned',
      '{{inSuccess}} tag(s) were successfully unassigned and {{inError}} failed to be unassigned',
      'No tags have been deleted', loggedUser
    );
    return result;
  }

  private static async setDefaultTagForUser(tenant: Tenant, userID: string) {
    // Clear default User's Tags
    await TagStorage.clearDefaultUserTag(tenant, userID);
    // Make the first active User's Tag
    const firstActiveTag = await TagStorage.getFirstActiveUserTag(tenant, userID, {
      issuer: true,
    });
    // Set it default
    if (firstActiveTag) {
      firstActiveTag.default = true;
      await TagStorage.saveTag(tenant, firstActiveTag);
    }
  }

  private static convertToCSV(req: Request, tags: Tag[], writeHeader = true): string {
    let headers = null;
    // Header
    if (writeHeader) {
      headers = [
        'id',
        'visualID',
        'description',
        'firstName',
        'name',
        'email',
      ].join(Constants.CSV_SEPARATOR);
    }
    // Content
    const rows = tags.map((tag) => {
      const row = [
        tag.id,
        tag.visualID,
        tag.description,
        tag.user?.firstName,
        tag.user?.name,
        tag.user?.email
      ].map((value) => Utils.escapeCsvValue(value));
      return row;
    }).join(Constants.CR_LF);
    return Utils.isNullOrUndefined(headers) ? Constants.CR_LF + rows : [headers, rows].join(Constants.CR_LF);
  }

  private static async getTags(req: Request, filteredRequest: HttpTagsGetRequest): Promise<DataResult<Tag>> {
    // Get authorization filters
    const authorizations = await AuthorizationService.checkAndGetTagsAuthorizations(
      req.tenant, req.user, filteredRequest, false);
    if (!authorizations.authorized) {
      return Constants.DB_EMPTY_DATA_RESULT;
    }
    // Get the tags
    const tags = await TagStorage.getTags(req.tenant,
      {
        search: filteredRequest.Search,
        issuer: filteredRequest.Issuer,
        active: filteredRequest.Active,
        withUser: filteredRequest.WithUser,
        userIDs: (filteredRequest.UserID ? filteredRequest.UserID.split('|') : null),
        ...authorizations.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizations.projectFields,
    );
    // Assign projected fields
    if (authorizations.projectFields) {
      tags.projectFields = authorizations.projectFields;
    }
    // Add Auth flags
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addTagsAuthorizations(req.tenant, req.user, tags as TagDataResult, authorizations);
    }
    return tags;
  }

  private static async processTag(action: ServerAction, req: Request, importedTag: ImportedTag, tagsToBeImported: ImportedTag[]): Promise<boolean> {
    try {
      const newImportedTag: ImportedTag = {
        id: importedTag.id.toUpperCase(),
        visualID: importedTag.visualID,
        description: importedTag.description ? importedTag.description : `Tag ID '${importedTag.id}'`,
        importedData: importedTag.importedData
      };
      // Validate Tag data
      TagValidatorRest.getInstance().validateImportedTagCreateReq(newImportedTag);
      // Set properties
      newImportedTag.importedBy = importedTag.importedBy;
      newImportedTag.importedOn = importedTag.importedOn;
      newImportedTag.status = ImportStatus.READY;
      let tagToImport = newImportedTag;
      // handle user part
      if (importedTag.name && importedTag.firstName && importedTag.email) {
        const newImportedUser: ImportedUser = {
          name: importedTag.name.toUpperCase(),
          firstName: importedTag.firstName,
          email: importedTag.email,
          siteIDs: importedTag.siteIDs
        };
        try {
          UserValidatorRest.getInstance().validateUserImportCreateReq(newImportedUser);
          tagToImport = { ...tagToImport, ...newImportedUser as ImportedTag };
        } catch (error) {
          await Logging.logWarning({
            tenantID: req.tenant.id,
            module: MODULE_NAME, method: 'processTag',
            action: action,
            message: `User cannot be imported with tag ${newImportedTag.id}`,
            detailedMessages: { tag: newImportedTag, error: error.message, stack: error.stack }
          });
        }
      }
      // Save it later on
      tagsToBeImported.push(tagToImport);
      return true;
    } catch (error) {
      await Logging.logError({
        tenantID: req.tenant.id,
        module: MODULE_NAME, method: 'importTag',
        action: action,
        message: `Tag ID '${importedTag.id}' cannot be imported`,
        detailedMessages: { tag: importedTag, error: error.stack }
      });
      return false;
    }
  }

  private static async checkAndDeleteTagRoaming(tenant: Tenant, loggedUser: UserToken, tag: Tag): Promise<void> {
    // OCPI
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.OCPI)) {
      try {
        const ocpiClient: EmspOCPIClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.EMSP) as EmspOCPIClient;
        if (ocpiClient) {
          await ocpiClient.pushToken({
            uid: tag.id,
            type: OCPIUtils.getOcpiTokenTypeFromID(tag.id),
            auth_id: tag.userID,
            visual_number: tag.visualID,
            issuer: tenant.name,
            valid: false,
            whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
            last_updated: new Date()
          });
        }
      } catch (error) {
        await Logging.logError({
          tenantID: tenant.id,
          module: MODULE_NAME, method: 'checkAndDeleteTagOCPI',
          action: ServerAction.TAG_DELETE,
          message: `Unable to disable the Tag ID '${tag.id}' with the OCPI IOP`,
          detailedMessages: { error: error.stack, tag }
        });
      }
    }
  }

  private static async updateTagRoaming(action: ServerAction, tenant: Tenant, loggedUser: UserToken, tag: Tag) {
    // Synchronize badges with IOP
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.OCPI)) {
      try {
        const ocpiClient: EmspOCPIClient = await OCPIClientFactory.getAvailableOcpiClient(
          tenant, OCPIRole.EMSP) as EmspOCPIClient;
        if (ocpiClient) {
          await ocpiClient.pushToken(
            OCPIUtils.buildEmspTokenFromTag(tenant, tag)
          );
        }
      } catch (error) {
        await Logging.logError({
          tenantID: tenant.id,
          action: action,
          module: MODULE_NAME, method: 'updateTagOCPI',
          message: `Unable to update the Tag ID '${tag.id}' with the OCPI IOP`,
          detailedMessages: { error: error.stack }
        });
      }
    }
  }
}
