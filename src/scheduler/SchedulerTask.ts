import { TaskConfig } from './TaskConfig';

export default interface SchedulerTask {
  run(config: TaskConfig): void;
}
