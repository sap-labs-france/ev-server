sudo rm /var/www/html/evse/* -R
sudo cp ftp/www/* /var/www/html/evse -R
sudo chmod +x /var/www/html/evse/* -R
sudo chown evse /var/www/html/evse/* -R

sudo rm /var/www/nodejs/evse/dist/* -R
sudo cp ftp/nodejs/* /var/www/nodejs/evse/dist -R
sudo chown evse /var/www/nodejs/evse/dist/* -R


