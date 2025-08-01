#!/bin/bash

# Create Initial Restaurant Data Script
# Creates basic restaurant configuration and data

echo "🍽️ Restaurant Web - Create Initial Data"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/restaurant-web"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo)${NC}"
    exit 1
fi

echo -e "${BLUE}=== CREATING INITIAL RESTAURANT DATA ===${NC}"

echo -e "\n${YELLOW}Creating basic restaurant configuration and data...${NC}"
docker-compose -f "$PROJECT_DIR/docker-compose.ec2.yml" exec -T web python -c "
import os
import django
from django.utils import timezone
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_ec2')
django.setup()

print('✅ Django setup complete')

# Create basic restaurant configuration
from config.models import RestaurantOperationalConfig, Unit, Zone, Table, Waiter, Container

print('\\n=== CREATING RESTAURANT CONFIGURATION ===')

# Check if active config exists
existing_config = RestaurantOperationalConfig.objects.filter(is_active=True).first()
if existing_config:
    print('✅ Active restaurant configuration already exists')
else:
    config = RestaurantOperationalConfig.objects.create(
        name='El Fogón de Don Soto - Configuración Inicial',
        opening_time='08:00:00',
        closing_time='22:00:00',
        operational_cutoff_time='04:00:00',
        is_active=True
    )
    print(f'✅ Created restaurant configuration: {config.name}')

print('\\n=== CREATING BASIC UNITS ===')

# Create basic units if they don't exist
basic_units = [
    {'name': 'Kilogramos', 'abbreviation': 'kg'},
    {'name': 'Gramos', 'abbreviation': 'g'},
    {'name': 'Litros', 'abbreviation': 'l'},
    {'name': 'Mililitros', 'abbreviation': 'ml'},
    {'name': 'Unidades', 'abbreviation': 'und'},
    {'name': 'Porciones', 'abbreviation': 'porción'},
]

for unit_data in basic_units:
    unit, created = Unit.objects.get_or_create(
        name=unit_data['name'],
        defaults={'abbreviation': unit_data['abbreviation']}
    )
    if created:
        print(f'✅ Created unit: {unit.name} ({unit.abbreviation})')
    else:
        print(f'ℹ️  Unit already exists: {unit.name}')

print('\\n=== CREATING BASIC ZONES ===')

# Create basic zones if they don't exist
basic_zones = [
    {'name': 'Terraza', 'description': 'Área al aire libre'},
    {'name': 'Salón Principal', 'description': 'Área principal del restaurante'},
    {'name': 'Salón VIP', 'description': 'Área reservada para eventos especiales'},
]

for zone_data in basic_zones:
    zone, created = Zone.objects.get_or_create(
        name=zone_data['name'],
        defaults={'description': zone_data['description']}
    )
    if created:
        print(f'✅ Created zone: {zone.name}')
    else:
        print(f'ℹ️  Zone already exists: {zone.name}')

print('\\n=== CREATING BASIC TABLES ===')

# Create basic tables if zones exist and no tables exist
zones = Zone.objects.all()
if zones.exists() and not Table.objects.exists():
    table_count = 0
    for zone in zones:
        # Create 3 tables per zone
        for i in range(1, 4):
            table = Table.objects.create(
                table_number=f'{zone.name[0]}{i}',  # T1, T2, T3 for Terraza, etc.
                zone=zone,
                capacity=4,
                is_active=True
            )
            table_count += 1
            print(f'✅ Created table: {table.table_number} in {zone.name}')
    print(f'✅ Created {table_count} tables total')
else:
    existing_tables = Table.objects.count()
    print(f'ℹ️  {existing_tables} tables already exist')

print('\\n=== CREATING BASIC WAITERS ===')

# Create basic waiters if they don't exist
basic_waiters = [
    {'name': 'Mesero Principal', 'is_active': True},
    {'name': 'Mesero Auxiliar', 'is_active': True},
]

for waiter_data in basic_waiters:
    waiter, created = Waiter.objects.get_or_create(
        name=waiter_data['name'],
        defaults={'is_active': waiter_data['is_active']}
    )
    if created:
        print(f'✅ Created waiter: {waiter.name}')
    else:
        print(f'ℹ️  Waiter already exists: {waiter.name}')

print('\\n=== CREATING BASIC CONTAINERS ===')

# Create basic containers if they don't exist
basic_containers = [
    {'name': 'Plato Normal', 'is_active': True},
    {'name': 'Plato Grande', 'is_active': True},
    {'name': 'Bowl', 'is_active': True},
    {'name': 'Para Llevar', 'is_active': True},
]

for container_data in basic_containers:
    container, created = Container.objects.get_or_create(
        name=container_data['name'],
        defaults={'is_active': container_data['is_active']}
    )
    if created:
        print(f'✅ Created container: {container.name}')
    else:
        print(f'ℹ️  Container already exists: {container.name}')

print('\\n=== SUMMARY ===')
print(f'Restaurant Configurations: {RestaurantOperationalConfig.objects.count()}')
print(f'Units: {Unit.objects.count()}')
print(f'Zones: {Zone.objects.count()}')
print(f'Tables: {Table.objects.count()}')
print(f'Waiters: {Waiter.objects.count()}')
print(f'Containers: {Container.objects.count()}')

print('\\n✅ Initial restaurant data creation completed!')
" 2>/dev/null || echo "Could not create initial data"

echo -e "\n${GREEN}=== INITIAL DATA CREATION COMPLETE ===${NC}"
echo -e "${YELLOW}The restaurant now has basic configuration and data.${NC}"
echo -e "${BLUE}You can now access the dashboard without 404 errors.${NC}"