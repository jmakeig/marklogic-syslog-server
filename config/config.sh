

# Clear the config
mlvm stop; rm -rf ~/Workspaces/mlvm/versions/8.0-20150930/Support/Data; mlvm start; mlvm init

. resty


# Set up cURL defaults
resty ':8002/manage/v2' -H 'Accept: application/json' -H 'Content-Type: application/json' --digest --user 'admin:********'

MLHOST=`GET /hosts | jq -r '."host-default-list"."list-items"."list-item"[0].nameref'`
echo "Configuring host $MLHOST"

function createdb(){
  # Create database
  POST /databases '{"database-name": "'$1'"}'

  # Create forests for Logs
  POST /forests '{"forest-name": "'$1'-1", "host": "'$MLHOST'", "database": "'$1'"}'
  POST /forests '{"forest-name": "'$1'-2", "host": "'$MLHOST'", "database": "'$1'"}'
}

createdb 'Logs'
createdb 'Logs-Modules'
createdb 'Logs-Triggers'


POST /roles '{ "role-name": "logs-reader", "role": [ "rest-reader", "alert-user" ] }'
POST /roles '{ "role-name": "logs-writer", "role": [ "logs-reader", "rest-writer" ]}'
POST /roles '{ "role-name": "logs-admin", "role": [ "rest-admin", "alert-admin", "logs-writer" ] }'

resty ':8002/LATEST' -H 'Accept: application/json' -H 'Content-Type: application/json' --digest --user 'admin:********'
POST /rest-apis '{"rest-api":{"name":"Logs-REST", "port": 3033, "database": "Logs", "modules-database": "Logs-Modules"}}'

# Create database
#POST /databases '{"database-name": "Logs"}'

# Create forests for Logs
#POST /forests '{"forest-name": "Logs-1", "host": "'$MLHOST'", "database": "Logs"}'
#POST /forests '{"forest-name": "Logs-2", "host": "'$MLHOST'", "database": "Logs"}'