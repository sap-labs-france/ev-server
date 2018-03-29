sudo service mongod restart

sudo service nginx restart
sleep 1s
sudo ps -aux | grep nginx

sudo pm2 restart 0
sleep 1s
pm2 list


