export default interface SchedulerConfiguration {
  active: boolean;
  tasks: SchedulerTask[];
}

interface SchedulerTask {
  name: string;
  active: boolean;
  periodicity: string;
  numberOfInstance?: number;
  config: any;
}
