import express, { NextFunction, Request, Response } from 'express';

import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import RouterUtils from '../../../../../utils/RouterUtils';
import ReservationService from '../../service/ReservationService';

export default class ReservationRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteReservations();
    this.buildRouteReservation();
    this.buildRouteReservationCreate();
    this.buildRouteReservationUpdate();
    this.buildRouteReservationDelete();
    this.buildRouteReservationsExport();
    this.buildRouteReservationCancel();
    this.buildRouteReservationsDelete();
    // this.buildRouteReservationsImport();
    return this.router;
  }

  private buildRouteReservations(): void {
    this.router.get(
      `/${RESTServerRoute.REST_RESERVATIONS}`,
      (req: Request, res: Response, next: NextFunction) => {
        void RouterUtils.handleRestServerAction(
          ReservationService.handleGetReservations.bind(this),
          ServerAction.RESERVATIONS,
          req,
          res,
          next
        );
      }
    );
  }

  private buildRouteReservation(): void {
    this.router.get(
      `/${RESTServerRoute.REST_RESERVATION}`,
      (req: Request, res: Response, next: NextFunction) => {
        req.query.ID = req.params.id;
        void RouterUtils.handleRestServerAction(
          ReservationService.handleGetReservation.bind(this),
          ServerAction.RESERVATION,
          req,
          res,
          next
        );
      }
    );
  }

  private buildRouteReservationCreate(): void {
    this.router.post(
      `/${RESTServerRoute.REST_RESERVATIONS}`,
      (req: Request, res: Response, next: NextFunction) => {
        void RouterUtils.handleRestServerAction(
          ReservationService.handleCreateReservation.bind(this),
          ServerAction.RESERVATION_CREATE,
          req,
          res,
          next
        );
      }
    );
  }

  private buildRouteReservationUpdate(): void {
    this.router.put(
      `/${RESTServerRoute.REST_RESERVATION}`,
      (req: Request, res: Response, next: NextFunction) => {
        req.query.ID = req.params.id;
        void RouterUtils.handleRestServerAction(
          ReservationService.handleUpdateReservation.bind(this),
          ServerAction.RESERVATION_UPDATE,
          req,
          res,
          next
        );
      }
    );
  }

  private buildRouteReservationDelete(): void {
    this.router.delete(
      `/${RESTServerRoute.REST_RESERVATION}`,
      (req: Request, res: Response, next: NextFunction) => {
        req.query.ID = req.params.id;
        void RouterUtils.handleRestServerAction(
          ReservationService.handleDeleteReservation.bind(this),
          ServerAction.RESERVATION_DELETE,
          req,
          res,
          next
        );
      }
    );
  }

  private buildRouteReservationsDelete(): void {
    this.router.delete(
      `/${RESTServerRoute.REST_RESERVATIONS}`,
      (req: Request, res: Response, next: NextFunction) => {
        void RouterUtils.handleRestServerAction(
          ReservationService.handleDeleteReservations.bind(this),
          ServerAction.RESERVATION_DELETE,
          req,
          res,
          next
        );
      }
    );
  }

  private buildRouteReservationsExport(): void {
    this.router.get(
      `/${RESTServerRoute.REST_RESERVATIONS_EXPORT}`,
      (req: Request, res: Response, next: NextFunction) => {
        void RouterUtils.handleRestServerAction(
          ReservationService.handleExportReservations.bind(this),
          ServerAction.RESERVATIONS_EXPORT,
          req,
          res,
          next
        );
      }
    );
  }

  private buildRouteReservationCancel(): void {
    this.router.put(
      `/${RESTServerRoute.REST_RESERVATION_CANCEL}`,
      (req: Request, res: Response, next: NextFunction) => {
        req.body.ID = req.params.id;
        void RouterUtils.handleRestServerAction(
          ReservationService.handleCancelReservation.bind(this),
          ServerAction.RESERVATION_CANCEL,
          req,
          res,
          next
        );
      }
    );
  }

  // private buildRouteReservationsImport(): void {
  //   this.router.post(
  //     `/${RESTServerRoute.REST_RESERVATIONS_IMPORT}`,
  //     (req: Request, res: Response, next: NextFunction) => {
  //       void RouterUtils.handleRestServerAction(
  //         ReservationService.handleImportReservations.bind(this),
  //         ServerAction.RESERVATIONS_IMPORT,
  //         req,
  //         res,
  //         next
  //       );
  //     }
  //   );
  // }
}
