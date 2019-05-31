import { TaskConfig } from './TaskConfig';

export interface SchedulerTask {
  run(config: TaskConfig): void;
}
