/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../RouterUtils';
import TagService from '../../service/TagService';

export default class TagRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteTags();
    this.buildRouteTag();
    this.buildRouteCreateTag();
    this.buildRouteDeleteTag();
    this.buildRouteDeleteTags();
    this.buildRouteUpdateTag();
    this.buildRouteUpdateTagByVisualID();
    this.buildRouteImportTag();
    this.buildRouteExportTag();
    this.buildRouteAssignTag();
    this.buildRouteUnassignTag();
    this.buildRouteUnassignTags();
    return this.router;
  }

  private buildRouteTags(): void {
    this.router.get(`/${ServerRoute.REST_TAGS}`, async (req: Request, res: Response, next: NextFunction) => {
      if (req.query.VisualID) {
        await RouterUtils.handleServerAction(TagService.handleGetTagByVisualID.bind(this), ServerAction.TAG_BY_VISUAL_ID, req, res, next);
      } else {
        await RouterUtils.handleServerAction(TagService.handleGetTags.bind(this), ServerAction.TAGS, req, res, next);
      }
    });
  }

  private buildRouteTag(): void {
    this.router.get(`/${ServerRoute.REST_TAG}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(TagService.handleGetTag.bind(this), ServerAction.TAG, req, res, next);
    });
  }

  private buildRouteCreateTag(): void {
    this.router.post(`/${ServerRoute.REST_TAGS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(TagService.handleCreateTag.bind(this), ServerAction.TAG_CREATE, req, res, next);
    });
  }

  private buildRouteDeleteTag(): void {
    this.router.delete(`/${ServerRoute.REST_TAG}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(TagService.handleDeleteTag.bind(this), ServerAction.TAG_DELETE, req, res, next);
    });
  }

  private buildRouteDeleteTags(): void {
    this.router.delete(`/${ServerRoute.REST_TAGS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TagService.handleDeleteTags.bind(this), ServerAction.TAGS_DELETE, req, res, next);
    });
  }

  private buildRouteUpdateTag(): void {
    this.router.put(`/${ServerRoute.REST_TAG}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TagService.handleUpdateTag.bind(this), ServerAction.TAG_UPDATE, req, res, next);
    });
  }

  private buildRouteUpdateTagByVisualID(): void {
    this.router.put(`/${ServerRoute.REST_TAGS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TagService.handleUpdateTagByVisualID.bind(this), ServerAction.TAG_UPDATE_BY_VISUAL_ID, req, res, next);
    });
  }

  private buildRouteImportTag(): void {
    this.router.post(`/${ServerRoute.REST_TAGS_IMPORT}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TagService.handleImportTags.bind(this), ServerAction.TAGS_IMPORT, req, res, next);
    });
  }

  private buildRouteExportTag(): void {
    this.router.get(`/${ServerRoute.REST_TAGS_EXPORT}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TagService.handleExportTags.bind(this), ServerAction.TAGS_EXPORT, req, res, next);
    });
  }

  private buildRouteAssignTag(): void {
    this.router.put(`/${ServerRoute.REST_TAG_ASSIGN}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TagService.handleAssignTag.bind(this), ServerAction.TAG_ASSIGN, req, res, next);
    });
  }

  private buildRouteUnassignTag(): void {
    this.router.put(`/${ServerRoute.REST_TAG_UNASSIGN}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TagService.handleUnassignTag.bind(this), ServerAction.TAG_UNASSIGN, req, res, next);
    });
  }

  private buildRouteUnassignTags(): void {
    this.router.put(`/${ServerRoute.REST_TAGS_UNASSIGN}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TagService.handleUnassignTags.bind(this), ServerAction.TAGS_UNASSIGN, req, res, next);
    });
  }
}
