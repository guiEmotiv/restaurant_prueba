#!/usr/bin/env python3
"""
Production deployment script that reads environment from JSON file.
This avoids all shell escaping issues with special characters in secrets.
"""
import json
import os
import subprocess
import sys
import time

def run_command(cmd, check=True):
    """Run a command and return its output."""
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(f"STDERR: {result.stderr}", file=sys.stderr)
    if check and result.returncode != 0:
        print(f"Command failed with exit code {result.returncode}")
        sys.exit(result.returncode)
    return result

def main():
    # Load environment from JSON file
    with open('/tmp/deployment-env.json', 'r') as f:
        env_vars = json.load(f)
    
    # Export all environment variables
    for key, value in env_vars.items():
        os.environ[key] = value
    
    print("🚀 Production deployment started...")
    print(f"Working directory: {os.getcwd()}")
    print(f"User: {os.getlogin() if hasattr(os, 'getlogin') else 'unknown'}")
    
    # Validate required environment variables
    required_vars = [
        "ECR_REGISTRY", "ECR_REPOSITORY", "VERSION", "AWS_REGION",
        "COGNITO_USER_POOL_ID", "COGNITO_APP_CLIENT_ID", 
        "DJANGO_SECRET_KEY", "EC2_HOST"
    ]
    
    for var in required_vars:
        if var not in env_vars or not env_vars[var]:
            print(f"❌ Error: Required environment variable {var} is not set")
            sys.exit(1)
    
    # Set defaults
    env_vars['DOMAIN_NAME'] = env_vars.get('DOMAIN_NAME', 'localhost')
    env_vars['GITHUB_REPOSITORY'] = env_vars.get('GITHUB_REPOSITORY', 'guiEmotiv/restaurant-web')
    
    # Navigate to application directory
    app_dir = '/opt/restaurant-web'
    if not os.path.exists(app_dir):
        print(f"❌ App directory {app_dir} not found")
        sys.exit(1)
    
    os.chdir(app_dir)
    
    # Create required directories
    for dir_name in ['data', 'backups', 'logs']:
        os.makedirs(dir_name, exist_ok=True)
    
    # Backup database if it exists
    if os.path.exists('data/restaurant_prod.sqlite3'):
        backup_dir = f"backups/backup-{time.strftime('%Y%m%d-%H%M%S')}"
        os.makedirs(backup_dir, exist_ok=True)
        run_command(f"cp data/restaurant_prod.sqlite3 {backup_dir}/")
        print(f"✅ Database backed up to {backup_dir}")
    
    # Login to ECR
    print("🔐 Logging into ECR...")
    login_cmd = f"aws ecr get-login-password --region {env_vars['AWS_REGION']} | " \
                f"docker login --username AWS --password-stdin {env_vars['ECR_REGISTRY']}"
    run_command(login_cmd)
    
    # Pull Docker image
    print("📥 Pulling Docker image...")
    full_image = f"{env_vars['ECR_REGISTRY']}/{env_vars['ECR_REPOSITORY']}:{env_vars['VERSION']}"
    run_command(f"docker pull {full_image}")
    
    # Create production environment file
    print("⚙️ Creating production environment...")
    env_content = f"""AWS_REGION={env_vars['AWS_REGION']}
COGNITO_USER_POOL_ID={env_vars['COGNITO_USER_POOL_ID']}
COGNITO_APP_CLIENT_ID={env_vars['COGNITO_APP_CLIENT_ID']}
DATABASE_PATH=/opt/restaurant-web/data
DATABASE_NAME=restaurant_prod.sqlite3
DEBUG=False
USE_COGNITO_AUTH=True
ALLOWED_HOSTS={env_vars['EC2_HOST']},{env_vars['DOMAIN_NAME']}
SECRET_KEY={env_vars['DJANGO_SECRET_KEY']}
DOMAIN_NAME={env_vars['DOMAIN_NAME']}
EC2_PUBLIC_IP={env_vars['EC2_HOST']}
"""
    with open('.env.ec2', 'w') as f:
        f.write(env_content)
    
    # Download docker-compose.yml
    print("📥 Downloading docker-compose configuration...")
    compose_url = f"https://raw.githubusercontent.com/{env_vars['GITHUB_REPOSITORY']}/main/docker-compose.yml"
    run_command(f"curl -sSL '{compose_url}' -o docker-compose.yml")
    
    # Stop existing services
    print("⏹️ Stopping existing services...")
    run_command("docker-compose --profile production down --timeout 30", check=False)
    
    # Update docker-compose to use new image
    print("🔄 Updating docker-compose configuration...")
    run_command(f"cp docker-compose.yml docker-compose.yml.backup")
    
    # Read and update docker-compose.yml
    with open('docker-compose.yml', 'r') as f:
        compose_content = f.read()
    
    # Replace image reference
    compose_content = compose_content.replace(
        'image: restaurant-web:', 
        f'image: {full_image}'.split(':')[0] + ':'
    )
    
    with open('docker-compose.yml', 'w') as f:
        f.write(compose_content)
    
    # Start services
    print("🚀 Starting production services...")
    run_command("docker-compose --profile production up -d")
    
    # Wait for services
    print("⏳ Waiting for services to initialize...")
    time.sleep(45)
    
    # Run migrations
    print("🗄️ Running database migrations...")
    run_command("docker-compose exec -T app python manage.py migrate")
    
    # Collect static files
    print("📁 Collecting static files...")
    run_command("docker-compose exec -T app python manage.py collectstatic --noinput")
    
    # Health check
    print("🏥 Running health checks...")
    for i in range(1, 6):
        result = run_command("curl -f -s http://localhost/api/v1/health/", check=False)
        if result.returncode == 0:
            print("✅ Health check passed! Deployment successful!")
            run_command("docker-compose --profile production ps")
            print("🎉 Production deployment completed successfully!")
            sys.exit(0)
        else:
            print(f"⏳ Health check attempt {i}/5...")
            time.sleep(15)
    
    # Health check failed
    print("❌ Health check failed after 5 attempts")
    print("📊 Container status:")
    run_command("docker-compose --profile production ps")
    print("📋 Container logs:")
    run_command("docker-compose --profile production logs --tail=50")
    sys.exit(1)

if __name__ == '__main__':
    main()