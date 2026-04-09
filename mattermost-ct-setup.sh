#!/bin/bash
set -euo pipefail

DBPASS_FILE=/root/mattermost-db.env
SQL_FILE=/tmp/set-mm-pass.sql
CONFIG_FILE=/opt/mattermost/config/config.json
SITE_URL=https://mattermost.aualaohana.com

DBPASS=$(openssl rand -base64 24 | tr -d '\n')
printf 'DBPASS=%s\n' "$DBPASS" > "$DBPASS_FILE"
chmod 600 "$DBPASS_FILE"

python3 - <<PY
from pathlib import Path
pw = Path('/root/mattermost-db.env').read_text().strip().split('=',1)[1]
Path('/tmp/set-mm-pass.sql').write_text(f"ALTER USER mattermost WITH PASSWORD '{pw}';\n")
PY
chmod 644 "$SQL_FILE"
su - postgres -c "psql -f $SQL_FILE"
rm -f "$SQL_FILE"

python3 - <<PY
import json
from pathlib import Path
pw = Path('/root/mattermost-db.env').read_text().strip().split('=',1)[1]
p = Path('/opt/mattermost/config/config.json')
config = json.loads(p.read_text())
config['SqlSettings']['DriverName'] = 'postgres'
config['SqlSettings']['DataSource'] = f'postgres://mattermost:{pw}@localhost:5432/mattermost?sslmode=disable&connect_timeout=10'
config['ServiceSettings']['ListenAddress'] = ':8065'
config['ServiceSettings']['SiteURL'] = 'https://mattermost.aualaohana.com'
config['FileSettings']['Directory'] = '/opt/mattermost/data/'
p.write_text(json.dumps(config, indent=2))
PY

chown mattermost:mattermost "$CONFIG_FILE"
systemctl daemon-reload
systemctl restart mattermost
sleep 3
systemctl --no-pager --full status mattermost | sed -n '1,80p'
curl -fsS http://127.0.0.1:8065/api/v4/system/ping
