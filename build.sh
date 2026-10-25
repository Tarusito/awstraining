#!/bin/sh
set -eu
python -m zipfile -e nube-source.zip .
cp ui/*.html ui/*.css ui/*.mjs study/
python -m pip install -r requirements-render.txt
python render_prepare.py
