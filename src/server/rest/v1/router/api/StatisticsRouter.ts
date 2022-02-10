/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../RouterUtils';
import StatisticService from '../../service/StatisticService';
import TransactionService from '../../service/TransactionService';

export default class StatisticsRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteStatisticsExport();
    this.buildRouteChargingStationConsumptionStatistics();
    this.buildRouteChargingStationUsageStatistics();
    this.buildRouteChargingStationInactivityStatistics();
    this.buildRouteChargingStationTransactionsStatistics();
    this.buildRouteChargingStationPricingStatistics();
    this.buildRouteUserConsumptionStatistics();
    this.buildRouteUserUsageStatistics();
    this.buildRouteUserInactivityStatistics();
    this.buildRouteUserTransactionsStatistics();
    this.buildRouteUserPricingStatistics();
    this.buildRouteTransactionsYearsStatistics();
    return this.router;
  }

  private buildRouteStatisticsExport(): void {
    this.router.get(`/${ServerRoute.REST_STATISTICS_EXPORT}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(StatisticService.handleExportStatistics.bind(this), ServerAction.STATISTICS_EXPORT, req, res, next);
    });
  }

  private buildRouteChargingStationConsumptionStatistics(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATION_CONSUMPTION_STATISTICS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(StatisticService.handleGetChargingStationConsumptionStatistics.bind(this), ServerAction.CHARGING_STATION_CONSUMPTION_STATISTICS, req, res, next);
    });
  }

  private buildRouteChargingStationUsageStatistics(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATION_USAGE_STATISTICS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(StatisticService.handleGetChargingStationUsageStatistics.bind(this), ServerAction.CHARGING_STATION_USAGE_STATISTICS, req, res, next);
    });
  }

  private buildRouteChargingStationInactivityStatistics(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATION_INACTIVITY_STATISTICS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(StatisticService.handleGetChargingStationInactivityStatistics.bind(this), ServerAction.CHARGING_STATION_INACTIVITY_STATISTICS, req, res, next);
    });
  }

  private buildRouteChargingStationTransactionsStatistics(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATION_TRANSACTIONS_STATISTICS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(StatisticService.handleGetChargingStationTransactionsStatistics.bind(this), ServerAction.CHARGING_STATION_TRANSACTIONS_STATISTICS, req, res, next);
    });
  }

  private buildRouteChargingStationPricingStatistics(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATION_PRICING_STATISTICS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(StatisticService.handleGetChargingStationPricingStatistics.bind(this), ServerAction.CHARGING_STATION_PRICING_STATISTICS, req, res, next);
    });
  }

  private buildRouteUserConsumptionStatistics(): void {
    this.router.get(`/${ServerRoute.REST_USER_CONSUMPTION_STATISTICS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(StatisticService.handleGetUserConsumptionStatistics.bind(this), ServerAction.USER_CONSUMPTION_STATISTICS, req, res, next);
    });
  }

  private buildRouteUserUsageStatistics(): void {
    this.router.get(`/${ServerRoute.REST_USER_USAGE_STATISTICS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(StatisticService.handleGetUserUsageStatistics.bind(this), ServerAction.USER_USAGE_STATISTICS, req, res, next);
    });
  }

  private buildRouteUserInactivityStatistics(): void {
    this.router.get(`/${ServerRoute.REST_USER_INACTIVITY_STATISTICS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(StatisticService.handleGetUserInactivityStatistics.bind(this), ServerAction.USER_INACTIVITY_STATISTICS, req, res, next);
    });
  }

  private buildRouteUserTransactionsStatistics(): void {
    this.router.get(`/${ServerRoute.REST_USER_TRANSACTIONS_STATISTICS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(StatisticService.handleGetUserTransactionsStatistics.bind(this), ServerAction.USER_TRANSACTIONS_STATISTICS, req, res, next);
    });
  }

  private buildRouteUserPricingStatistics(): void {
    this.router.get(`/${ServerRoute.REST_USER_PRICING_STATISTICS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(StatisticService.handleGetUserPricingStatistics.bind(this), ServerAction.USER_PRICING_STATISTICS, req, res, next);
    });
  }

  private buildRouteTransactionsYearsStatistics(): void {
    this.router.get(`/${ServerRoute.REST_TRANSACTION_YEARS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TransactionService.handleGetTransactionYears.bind(this), ServerAction.TRANSACTION_YEARS, req, res, next);
    });
  }
}
