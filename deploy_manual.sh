#!/bin/bash

# Script manual para desplegar en EC2
EC2_HOST="44.248.47.186"

echo "🚀 Desplegando aplicación en EC2..."

# Conectar a EC2 y ejecutar comandos
ssh -o StrictHostKeyChecking=no ubuntu@$EC2_HOST << 'ENDSSH'
    cd /home/ubuntu/restaurant-web
    
    echo "📥 Actualizando código..."
    git pull origin main
    
    echo "🏗️ Reconstruyendo aplicación..."
    docker-compose -f docker-compose.ec2.yml down
    docker-compose -f docker-compose.ec2.yml build --no-cache
    docker-compose -f docker-compose.ec2.yml up -d
    
    echo "⏳ Esperando que la aplicación esté lista..."
    sleep 10
    
    echo "📊 Estado de la aplicación:"
    docker-compose -f docker-compose.ec2.yml ps
    
    echo "✅ Despliegue completo!"
ENDSSH

echo "🎉 Despliegue finalizado."