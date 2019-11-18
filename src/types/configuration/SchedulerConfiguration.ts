export default interface SchedulerConfiguration {
  active: boolean;
  tasks: SchedulerTask[];
}

interface SchedulerTask {
  name: string;
  active: boolean;
  periodicity: string;
  config: any;
}
