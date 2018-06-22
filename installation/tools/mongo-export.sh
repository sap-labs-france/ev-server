rm -rf export
mkdir export
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection companies --out export/companies.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection companylogos --out export/companylogos.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection sites --out export/sites.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection siteusers --out export/siteusers.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection siteimages --out export/siteimages.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection siteareas --out export/siteareas.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection siteareaimages --out export/siteareaimages.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection authorizes --out export/authorizes.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection bootnotifications --out export/bootnotifications.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection chargingstations --out export/chargingstations.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection configurations --out export/configurations.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection datatransfers --out export/datatransfers.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection metervalues --out export/metervalues.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection migrations --out export/migrations.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection eulas --out export/eulas.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection notifications --out export/notifications.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection pricings --out export/pricings.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection statusnotifications --out export/statusnotifications.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection tags --out export/tags.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection transactions --out export/transactions.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection users --out export/users.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection userimages --out export/userimages.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection vehiclemanufacturers --out export/vehiclemanufacturers.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection vehiclemanufacturerlogos --out export/vehiclemanufacturerlogos.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection vehicles --out export/vehicles.json
mongoexport --db evse --port 32500 --authenticationDatabase "admin" --username "evse-admin" --password "666@@@-6@6@6@<->###999-#9#9#9" --collection vehicleimages --out export/vehicleimages.json
