# Frontend Troubleshooting Guide for EC2

## Architecture Overview
- **Frontend**: Built React app served by system nginx at `/var/www/restaurant`
- **Backend**: Django running in Docker container on port 8000
- **Nginx**: System nginx (not Docker) proxies `/api/*` to backend

## Common Issues and Solutions

### 1. Frontend Not Loading (Blank Page)

**Check nginx root directory:**
```bash
sudo ls -la /var/www/restaurant/
# Should show index.html and assets/
```

**If missing, rebuild and copy:**
```bash
cd /opt/restaurant-web/frontend
sudo npm run build
sudo rm -rf /var/www/restaurant/*
sudo cp -r dist/* /var/www/restaurant/
sudo chown -R www-data:www-data /var/www/restaurant
```

### 2. 404 Errors on Routes

**Check nginx config has try_files:**
```bash
sudo cat /etc/nginx/sites-available/xn--elfogndedonsoto-zrb.com | grep try_files
# Should show: try_files $uri $uri/ /index.html;
```

### 3. API Connection Errors

**Check if backend is running:**
```bash
sudo docker-compose -f /opt/restaurant-web/docker-compose.ec2.yml ps
# Should show web container as "Up"
```

**Test API directly:**
```bash
curl http://localhost:8000/api/v1/health/
# Should return {"status":"ok"}
```

**Check nginx proxy:**
```bash
curl https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/
# Should also return {"status":"ok"}
```

### 4. Authentication Errors

**Verify Cognito configuration in built files:**
```bash
grep -r "us-west-2_bdCwF60ZI" /var/www/restaurant/assets/*.js
# Should find the User Pool ID in the built files
```

**Check if .env.production was used during build:**
```bash
cd /opt/restaurant-web/frontend
cat .env.production
# Should show VITE_API_URL and Cognito settings
```

### 5. SSL/HTTPS Issues

**Check certificate:**
```bash
sudo certbot certificates
# Should show valid certificate for the domain
```

**Test HTTPS:**
```bash
curl -I https://www.xn--elfogndedonsoto-zrb.com
# Should return 200 OK
```

### 6. Console Errors

**Common JavaScript errors:**
- "Failed to fetch" - API connection issue
- "Unauthorized" - Cognito token issue
- "CORS error" - Check nginx headers

### Quick Fix Script

Run the fix script:
```bash
sudo /opt/restaurant-web/deploy/fix-ec2-frontend.sh
```

### Full Rebuild

If nothing works, do a full rebuild:
```bash
cd /opt/restaurant-web
sudo ./deploy/build-deploy.sh
```

### Monitoring Commands

```bash
# Watch nginx logs
sudo tail -f /var/log/nginx/error.log

# Watch backend logs
sudo docker-compose -f docker-compose.ec2.yml logs -f web

# Check system resources
df -h
free -m
```

### Environment Variables Check

Frontend needs these at build time:
- `VITE_API_URL=https://www.xn--elfogndedonsoto-zrb.com`
- `VITE_AWS_REGION=us-west-2`
- `VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI`
- `VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0`

Backend needs these at runtime:
- `COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI`
- `COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0`
- `AWS_REGION=us-west-2`