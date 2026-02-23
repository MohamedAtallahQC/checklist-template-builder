#!/bin/bash

# Configuration
COMPOSE_FILE="docker/docker-compose.multi-db.yml"
ENV_FILE="docker/.env.multi-db"

function show_help() {
    echo "Usage: ./manage_multidb.sh [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  up      Start both databases"
    echo "  down    Stop both databases"
    echo "  status  Check status of containers"
    echo "  psql16  Connect to Checklist DB (PG 16)"
    echo "  psql14  Connect to Team Eval DB (PG 14)"
}

case "$1" in
    up)
        docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d
        ;;
    down)
        docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE down
        ;;
    status)
        docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE ps
        ;;
    psql16)
        source $ENV_FILE
        docker exec -it checklist_db psql -U $CHECKLIST_DB_USER -d $CHECKLIST_DB_NAME
        ;;
    psql14)
        source $ENV_FILE
        docker exec -it team-eval-postgres-multi psql -U $TEAM_EVAL_DB_USER -d $TEAM_EVAL_DB_NAME
        ;;
    *)
        show_help
        ;;
esac
