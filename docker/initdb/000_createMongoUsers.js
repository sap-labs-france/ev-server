db = db.getSiblingDB('admin');
db.createUser(
  {
    user: 'evse-admin',
    pwd: 'evse-admin-pwd',
    roles: [
      'read',
      'readWrite',
      'dbAdmin',
      'userAdmin',
      'clusterAdmin',
      'readAnyDatabase',
      'readWriteAnyDatabase',
      'userAdminAnyDatabase',
      'dbAdminAnyDatabase'
    ],
    passwordDigestor: "server"
  }
);

db = db.getSiblingDB('evse');
db.createUser(
  {
    user: 'evse-user',
    pwd: 'evse-user-pwd',
    roles: [
      'readWrite'
    ],
    passwordDigestor: "server"
  }
);
