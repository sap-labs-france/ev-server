import * as mongo from 'mongodb';

declare module 'mongodb' {
    interface Db {
        watch(pipeline?: object[], options?: mongo.ChangeStreamOptions & { startAtClusterTime?: mongo.Timestamp, session?: mongo.ClientSession }): mongo.ChangeStream;
    }
}
