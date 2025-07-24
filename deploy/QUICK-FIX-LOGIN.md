# 🚨 Quick Fix for Login 400 Error

## Problem
Getting `POST http://44.248.47.186/api/v1/auth/login/ 400 (Bad Request)` when trying to login.

## Most Likely Cause
The restaurant users were not created in the production database after the database was cleaned.

## 🚀 Quick Solutions

### Solution 1: Create Users (Most Common Fix)
```bash
# On your EC2 instance:
docker-compose -f docker-compose.ec2.yml exec web python manage.py create_restaurant_users
```

### Solution 2: Run Full Diagnosis
```bash
# On your EC2 instance:
./deploy/diagnose-login-issue.sh
```

### Solution 3: Clean Restart (If migrations are broken)
```bash
# On your EC2 instance:
./deploy/ec2-deploy.sh clean
```

## 🧪 Test Commands

### Check if users exist:
```bash
docker-compose -f docker-compose.ec2.yml exec web python manage.py shell -c "
from authentication.models import RestaurantUser
print(f'Users in DB: {RestaurantUser.objects.count()}')
for user in RestaurantUser.objects.all():
    print(f'- {user.username} ({user.role})')
"
```

### Test login with curl:
```bash
curl -X POST http://localhost/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin123!"}'
```

### Check container logs:
```bash
docker logs restaurant_web_ec2 --tail 20
```

## 📋 Default Users Created
- **admin** / Admin123!
- **mesero1** / Mesero123!
- **cajero1** / Cajero123!

## 🔄 If Still Failing
1. Check container is running: `docker ps`
2. Restart container: `docker-compose -f docker-compose.ec2.yml restart`
3. Check recent logs: `docker logs restaurant_web_ec2`
4. Try clean deployment: `./deploy/ec2-deploy.sh clean`

## ✅ Expected Success Response
```json
{
  "token": "abc123...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "allowed_views": ["dashboard", "categories", ...]
  },
  "message": "Login successful. Welcome Administrador!"
}
```