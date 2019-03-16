db = db.getSiblingDB('evse');
db.getCollection('default.users').insert({
  _id: ObjectId(),
  email: 'super.admin@ev.com',
  address: {
    address1: null,
    address2: null,
    postalCode: null,
    city: null,
    department: null,
    region: null,
    country: null,
    latitude: null,
    longitude: null
  },
  createdBy: null,
  createdOn: ISODate('2018-01-01T00:00:00.000+0000'),
  deleted: null,
  firstName: 'super',
  name: 'admin',
  password: '$2b$10$ry6kcJGEiv9Nxkb1l2DL0.20N0719Hs1e0NdB2RCPaHW6YDRjhjBy',
  passwordBlockedUntil: null,
  passwordWrongNbrTrials: NumberInt(0),
  role: 'S',
  status: 'A',
  verificationToken: null
});

db = db.getSiblingDB('evse');
db.getCollection('5c866e81a2d9593de43efdb4.users').insert({
  _id: ObjectId(),
  email: 'super.admin@ev.com',
  address: {
    address1: null,
    address2: null,
    postalCode: null,
    city: null,
    department: null,
    region: null,
    country: null,
    latitude: null,
    longitude: null
  },
  createdBy: null,
  createdOn: ISODate('2018-01-01T00:00:00.000+0000'),
  deleted: null,
  firstName: 'super',
  name: 'admin',
  password: '$2b$10$ry6kcJGEiv9Nxkb1l2DL0.20N0719Hs1e0NdB2RCPaHW6YDRjhjBy',
  passwordBlockedUntil: null,
  passwordWrongNbrTrials: NumberInt(0),
  role: 'A',
  status: 'A',
  verificationToken: null
});
