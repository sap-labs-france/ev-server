import os, { CpuInfo } from 'os';

import { ServerAction } from './Server';

export default interface PerformanceRecord {
  id?: string;
  tenantID: string;
  timestamp?: Date;
  durationMs?: number;
  sizeKb?: number;
  host: string;
  process: string;
  processMemoryUsage: NodeJS.MemoryUsage,
  processCPUUsage: NodeJS.CpuUsage,
  cpusInfo: CpuInfo[],
  memoryTotalGb: number;
  memoryFreeGb: number;
  loadAverageLastMin: number,
  networkInterface: NodeJS.Dict<os.NetworkInterfaceInfo[]>,
  numberOfChargingStations?: number;
  source: string;
  module: string;
  method: string;
  action: ServerAction|string;
  httpUrl?: string;
  httpMethod?: string;
  httpCode?: number;
  userID?: string;
  parentID?: string;
}
