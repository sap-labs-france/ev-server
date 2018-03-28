rm -rf export
mkdir export
mongoexport --db evse --collection companies --out export/companies.json
mongoexport --db evse --collection companylogos --out export/companylogos.json
mongoexport --db evse --collection sites --out export/sites.json
mongoexport --db evse --collection siteimages --out export/siteimages.json
mongoexport --db evse --collection siteareas --out export/siteareas.json
mongoexport --db evse --collection siteareaimages --out export/siteareaimages.json
mongoexport --db evse --collection authorizes --out export/authorizes.json
mongoexport --db evse --collection bootnotifications --out export/bootnotifications.json
mongoexport --db evse --collection chargingstations --out export/chargingstations.json
mongoexport --db evse --collection configurations --out export/configurations.json
mongoexport --db evse --collection datatransfers --out export/datatransfers.json
mongoexport --db evse --collection metervalues --out export/metervalues.json
mongoexport --db evse --collection migrations --out export/migrations.json
mongoexport --db evse --collection eulas --out export/eulas.json
mongoexport --db evse --collection notifications --out export/notifications.json
mongoexport --db evse --collection pricings --out export/pricings.json
mongoexport --db evse --collection statusnotifications --out export/statusnotifications.json
mongoexport --db evse --collection tags --out export/tags.json
mongoexport --db evse --collection transactions --out export/transactions.json
mongoexport --db evse --collection users --out export/users.json
mongoexport --db evse --collection userimages --out export/userimages.json
tar -czvf export/export.tar.gz export
