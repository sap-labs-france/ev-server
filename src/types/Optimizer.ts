/* tslint:disable */
/* eslint-disable */
// Generated using typescript-generator version 2.18.565 on 2020-03-02 15:20:30.

export interface OptimizeChargingProfilesRequest {
  state: StateStore;
  event: EventStore;
  verbosity?: number;
}

export interface OptimizeChargingProfilesResponse {
  cars?: Car[];
}

export interface StateStore {
  currentTimeSeconds: number;
  fuseTree?: FuseTree;
  chargingStations?: ChargingStationStore[];
  maximumSiteLimitKW?: number;
  cars: Car[];
  energyPriceHistory?: EnergyPriceHistory;
  carAssignments: CarAssignmentStore[];
}

export interface EventStore {
  carID?: number;
  chargingStationID?: number;
  energyPriceHistory?: EnergyPriceHistory;
  eventType: EventType;
}

export interface Car extends JSONSerializable, Loggable {
  id: number;
  name?: string;
  modelName?: string;
  carType: CarType;
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

export interface FuseTree extends JSONSerializable {
  rootFuse: Fuse;
  numberChargingStationsBottomLevel?: number;
}

export interface ChargingStationStore {
  id: number;
  fusePhase1: number;
  fusePhase2: number;
  fusePhase3: number;
  phaseToGrid?: { [P in Phase]?: Phase };
  phaseToChargingStation?: { [P in Phase]?: Phase };
}

export interface EnergyPriceHistory extends JSONSerializable {
  energyPrices?: number[];
  date?: string;
}

export interface CarAssignmentStore {
  carID: number;
  chargingStationID: number;
}

export interface JSONSerializable {
}

export interface Loggable {
}

export interface Fuse extends FuseTreeNode {
  "@type": "Fuse";
  id: number;
  fusePhase1: number;
  fusePhase2: number;
  fusePhase3: number;
  children: FuseTreeNodeUnion[];
}

export interface FuseTreeNode extends JSONSerializable {
  "@type": "Fuse" | "ChargingStation";
  children?: FuseTreeNodeUnion[];
  id?: number;
}

export interface ChargingStationOptimizer extends FuseTreeNode {
  "@type": "ChargingStation";
  id: number;
  fusePhase1?: number;
  fusePhase2?: number;
  fusePhase3?: number;
  phaseToGrid?: { [P in Phase]?: Phase };
  phaseToChargingStation?: { [P in Phase]?: Phase };
  isBEVAllowed?: boolean;
  isPHEVAllowed?: boolean;
  status?: StationStatus;
}

export type EventType = "CarArrival" | "CarDeparture" | "CarFinished" | "EnergyPriceChange" | "Reoptimize";

export type CarType = "BEV" | "PHEV" | "PETROL" | "DIESEL";

export type Phase = "PHASE_1" | "PHASE_2" | "PHASE_3";

export type StationStatus = "Free" | "Charging" | "Reserved" | "Blocked" | "Maintenance" | "Disconnected";

export type FuseTreeNodeUnion = Fuse | ChargingStation;
