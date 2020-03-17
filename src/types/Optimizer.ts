export interface OptimizerChargingProfilesRequest {
  state: OptimizerState;
  event: OptimizerEvent;
  verbosity?: number;
}

export interface OptimizerChargingProfilesResponse {
  cars?: OptimizerCar[];
}

export interface OptimizerState {
  currentTimeSeconds: number;
  optimizerFuseTree?: OptimizerFuseTree;
  chargingStations?: OptimizerChargingStation[];
  maximumSiteLimitKW?: number;
  cars: OptimizerCar[];
  energyPriceHistory?: OptimizerEnergyPriceHistory;
  carAssignments: OptimizerCarAssignment[];
}

export interface OptimizerEvent {
  carID?: number;
  chargingStationID?: number;
  energyPriceHistory?: OptimizerEnergyPriceHistory;
  eventType: OptimizerEventType;
}

export interface OptimizerCar {
  id: number;
  name?: string;
  modelName?: string;
  carType: OptimizerCarType;
  startCapacity?: number;
  timestampArrival: number;
  timestampDeparture?: number;
  maxCapacity: number;
  minCurrent: number;
  minCurrentPerPhase: number;
  maxCurrent: number;
  maxCurrentPerPhase: number;
  suspendable?: boolean;
  canUseVariablePower?: boolean;
  immediateStart?: boolean;
  minLoadingState?: number;
  canLoadPhase1?: number;
  canLoadPhase2?: number;
  canLoadPhase3?: number;
  currentPlan?: number[];
  chargingStarted?: boolean;
  chargedCapacity?: number;
}

export interface OptimizerFuseTree {
  rootFuse: OptimizerFuse;
  numberChargingStationsBottomLevel?: number;
}

export interface OptimizerEnergyPriceHistory {
  energyPrices?: number[];
  date?: string;
}

export interface OptimizerCarAssignment {
  carID: number;
  chargingStationID: number;
}

export interface OptimizerFuse extends OptimizerFuseTreeNode {
  id: number;
  fusePhase1: number;
  fusePhase2: number;
  fusePhase3: number;
  children: OptimizerFuseTreeNodeUnion[];
}

export interface OptimizerFuseTreeNode {
  children?: OptimizerFuseTreeNodeUnion[];
  id?: number;
}

export interface OptimizerChargingStation extends OptimizerFuseTreeNode {
  id: number;
  fusePhase1?: number;
  fusePhase2?: number;
  fusePhase3?: number;
  phaseToGrid?: { [P in OptimizerPhase]?: OptimizerPhase };
  phaseToChargingStation?: { [P in OptimizerPhase]?: OptimizerPhase };
  isBEVAllowed?: boolean;
  isPHEVAllowed?: boolean;
  status?: OptimizerStationStatus;
}

export type OptimizerEventType = 'CarArrival' | 'CarDeparture' | 'CarFinished' | 'EnergyPriceChange' | 'Reoptimize';

export type OptimizerCarType = 'BEV' | 'PHEV' | 'PETROL' | 'DIESEL';

export type OptimizerPhase = 'PHASE_1' | 'PHASE_2' | 'PHASE_3';

export type OptimizerStationStatus = 'Free' | 'Charging' | 'Reserved' | 'Blocked' | 'Maintenance' | 'Disconnected';

export type OptimizerFuseTreeNodeUnion = OptimizerFuse | OptimizerChargingStation;
