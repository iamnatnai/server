#/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

LOG_DIR=$SCRIPT_DIR"/server.log"
npm i
npx nodemon server.js > $LOG_DIR 2>&1 &