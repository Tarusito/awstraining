#!/bin/sh
set -eu
python -m zipfile -e nube-source.zip .
python -m pip install -r requirements-render.txt
python render_prepare.py
