import { TaskConfig } from '../TaskConfig';

export default interface SchedulerConfiguration {
  active: boolean;
  tasks: SchedulerTaskConfiguration[];
}

export interface SchedulerTaskConfiguration {
  name: string;
  active: boolean;
  periodicity: string;
  numberOfInstance?: number;
  config: TaskConfig | object;
}
