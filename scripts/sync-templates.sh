#!/bin/sh
# Copies the Cloudinary recipes and template graphics from the project's templates/ folder (the source of truth,
# outside this repo) into booth-tv/templates/, so the repo is self-contained for deployment.
# Run from anywhere: sh products/booth-tv/scripts/sync-templates.sh
set -e
HERE="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$HERE/../../templates"
DST="$HERE/templates"
mkdir -p "$DST/_source"
rsync -a --delete --exclude node_modules --exclude out --exclude .env "$SRC/cloudinary-setup/" "$DST/cloudinary-setup/"
rsync -a --delete "$SRC/cloudinary/" "$DST/cloudinary/"
cp "$SRC/_source/sample-selfie-maya.jpg" "$DST/_source/"
cp "$SRC/TEMPLATES.md" "$DST/"
echo "templates synced into $DST"
