# REQUIREMENTS

pip freeze > requirements-dev.txt
mv requirements-dev.txt requirements-dev.in
pip-compile requirements-dev.in

# DOCKER

docker-compose down --rmi all -v --remove-orphans
docker-compose down -v
docker system prune -f

# BASE DE DATOS

ls -la .env
docker-compose up -d db
sleep 30
docker-compose logs db
docker-compose exec db psql -U postgres -d restaurant_db -c "SELECT version();"
docker-compose exec db psql -U postgres -d restaurant_db

TRUNCATE TABLE public.category RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.unit RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.table RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.zone RESTART IDENTITY CASCADE;
\! clear
\dt public.*
\q

# REST FRAMEWORK WEB

docker-compose up web
docker-compose exec web
docker-compose exec web bash
docker-compose exec web python manage.py makemigrations
docker-compose exec web python manage.py migrate
docker compose exec web python manage.py check

docker-compose exec web python manage.py migrate ordering zero
docker-compose exec web python manage.py migrate shift zero
find ordering/migrations -type f -name "0*.py" -delete
find shift/migrations -type f -name "0*.py" -delete

docker-compose exec web pip install django-nested-admin

docker-compose exec web python manage.py createsuperuser
docker-compose build web

python manage.py startapp config
python manage.py startapp inventory
python manage.py startapp operation

docker-compose restart
docker-compose build

docker-compose exec web python manage.py collectstatic
docker-compose exec web python manage.py runserver