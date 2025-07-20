VENV?=.venv
PY?=$(VENV)/bin/python
DJ   ?= $(PY) backend/manage.py

init:
	$(PY) -m pip install --upgrade pip setuptools wheel
	$(PY) -m pip install -r requirements-dev.txt

deps:
	pip-compile -o requirements.txt requirements.in
	pip-compile -o requirements-dev.txt requirements-dev.in

audit:
	$(PY) -m pip_audit -r requirements-dev.txt

## ─────────────── targets ───────────────
run:            ## Arranca el servidor local
	$(DJ) runserver 0.0.0.0:8000

migrate:        ## Aplica migraciones
	$(DJ) migrate

createsuperuser:
	$(DJ) createsuperuser

shell:
	$(DJ) shell_plus --ipython || $(DJ) shell

test:
	pytest -q

coverage:
	pytest