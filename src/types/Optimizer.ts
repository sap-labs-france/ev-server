export interface OptimizerChargingProfilesRequest {
  event: OptimizerEvent;
  state: OptimizerState;
}

export interface OptimizerChargingProfilesResponse {
  cars?: OptimizerCar[];
}

export interface OptimizerState {
  fuseTree?: OptimizerFuseTree;
  cars: OptimizerCar[];
  carAssignments: OptimizerCarConnectorAssignment[];
  currentTimeSeconds: number;
}

export interface OptimizerEvent {
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

export interface OptimizerCarConnectorAssignment {
  carID: number;
  chargingStationID: number; // It's a connector but for the optimizer this is a Charging Station
}

export interface OptimizerFuseTreeNode {
  '@type': 'Fuse' | 'ChargingStation';
  id?: number;
  phase1Connected?: boolean;
  phase2Connected?: boolean;
  phase3Connected?: boolean;
  children?: OptimizerFuseTreeNode[];
}

export interface ConnectorAmps {
  numberOfConnectedPhase: number;
  totalAmps: number;
}

export interface OptimizerFuse extends OptimizerFuseTreeNode {
  '@type': 'Fuse';
  id: number;
  fusePhase1: number;
  fusePhase2: number;
  fusePhase3: number;
  children: OptimizerChargingStationFuse[];
}

export interface OptimizerChargingStationFuse extends OptimizerFuseTreeNode {
  '@type': 'Fuse'; // For the optimizer
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

export interface OptimizerChargingStationConnectorFuse extends OptimizerFuseTreeNode {
  '@type': 'ChargingStation'; // For the optimizer
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

export interface OptimizerResult {
  cars: OptimizerCar[];
}

export interface ExcludedAmperage {
  phase1: number;
  phase2: number;
  phase3: number;
}

export type OptimizerEventType = 'CarArrival' | 'CarDeparture' | 'CarFinished' | 'EnergyPriceChange' | 'Reoptimize';

export type OptimizerCarType = 'BEV' | 'PHEV' | 'PETROL' | 'DIESEL';

export type OptimizerPhase = 'PHASE_1' | 'PHASE_2' | 'PHASE_3';

export type OptimizerStationStatus = 'Free' | 'Charging' | 'Reserved' | 'Blocked' | 'Maintenance' | 'Disconnected';

export type OptimizerFuseTreeNodeUnion = OptimizerFuse | OptimizerChargingStationConnectorFuse;
