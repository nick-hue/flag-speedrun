#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${1:-/opt/flag_speedrun}"
SERVICE_NAME="${2:-flag-speedrun}"

echo "Building frontend..."
npm --prefix frontend run build

echo "Installing systemd unit..."
sudo install -D -m 0644 "deploy/flag-speedrun.service" "/etc/systemd/system/${SERVICE_NAME}.service"
sudo sed -i "s#/opt/flag_speedrun#${APP_DIR}#g" "/etc/systemd/system/${SERVICE_NAME}.service"

echo "Reloading systemd..."
sudo systemctl daemon-reload

echo "Enabling and restarting ${SERVICE_NAME}..."
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"

echo "Done. Check status with:"
echo "sudo systemctl status ${SERVICE_NAME}"
