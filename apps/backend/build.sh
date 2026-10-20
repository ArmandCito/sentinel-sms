#!/usr/bin/env bash
# Build step used by Render (see render.yaml) and handy for any PaaS.
set -o errexit
pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate --no-input
