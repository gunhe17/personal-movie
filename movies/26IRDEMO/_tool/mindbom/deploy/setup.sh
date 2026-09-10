#!/bin/bash
set -euo pipefail

#============================================================
# MindBom - Lightsail Initial Setup Script
# Usage: ./deploy/setup.sh <domain> <email>
# Example: ./deploy/setup.sh mindbom.example.com admin@example.com
#
# Prerequisites: docker, docker compose, git
#============================================================

DOMAIN="${1:?Usage: $0 <domain> <email>}"
EMAIL="${2:?Usage: $0 <domain> <email>}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== MindBom Deploy Setup ==="
echo "Domain: $DOMAIN"
echo "Email:  $EMAIL"
echo ""

#------------------------------------------------------------
# 1. Environment file check
#------------------------------------------------------------
echo "[1/4] Checking environment file..."
if [ ! -f "$PROJECT_DIR/.env.production" ]; then
    echo ""
    echo "ERROR: .env.production not found!"
    echo "  cp .env.production.example .env.production"
    echo "  nano .env.production"
    echo ""
    exit 1
fi

#------------------------------------------------------------
# 3. Create initial self-signed cert (for nginx to start)
#------------------------------------------------------------
echo "[2/4] Creating initial self-signed certificate..."
CERT_DIR="$PROJECT_DIR/certbot/conf/live/$DOMAIN"
mkdir -p "$CERT_DIR"

if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
    openssl req -x509 -nodes -days 1 \
        -newkey rsa:2048 \
        -keyout "$CERT_DIR/privkey.pem" \
        -out "$CERT_DIR/fullchain.pem" \
        -subj "/CN=$DOMAIN"
fi

#------------------------------------------------------------
# 4. Build and start services
#------------------------------------------------------------
echo "[3/4] Building and starting services..."
cd "$PROJECT_DIR"
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

echo "Waiting for services to be healthy..."
sleep 10

#------------------------------------------------------------
# 5. Obtain real SSL certificate via Certbot container
#------------------------------------------------------------
echo "[4/4] Obtaining SSL certificate with Certbot..."

# Stop nginx to free port 80
docker compose -f docker-compose.prod.yml stop nginx

# Run certbot in standalone mode via docker
docker run --rm \
    -p 80:80 \
    -v "$PROJECT_DIR/certbot/conf:/etc/letsencrypt" \
    -v "$PROJECT_DIR/certbot/www:/var/www/certbot" \
    certbot/certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN"

# Restart nginx with real cert
docker compose -f docker-compose.prod.yml start nginx

#------------------------------------------------------------
# Auto-renewal cron (every 12 hours)
#------------------------------------------------------------
echo "Setting up auto-renewal cron..."
RENEW_CMD="0 */12 * * * docker compose -f $PROJECT_DIR/docker-compose.prod.yml run --rm certbot renew --webroot -w /var/www/certbot && docker compose -f $PROJECT_DIR/docker-compose.prod.yml exec nginx nginx -s reload"
(crontab -l 2>/dev/null; echo "$RENEW_CMD") | sort -u | crontab -

#------------------------------------------------------------
# Done
#------------------------------------------------------------
echo ""
echo "=== Setup Complete ==="
echo "  Site:  https://$DOMAIN"
echo "  API:   https://$DOMAIN/api/v1"
echo ""
echo "Useful commands:"
echo "  docker compose -f docker-compose.prod.yml logs -f        # View logs"
echo "  docker compose -f docker-compose.prod.yml restart api    # Restart API"
echo "  docker compose -f docker-compose.prod.yml down           # Stop all"
echo ""
