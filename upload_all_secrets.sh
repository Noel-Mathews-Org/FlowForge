#!/bin/bash
echo "Uploading Dev Secrets..."
./upload_secrets.sh -v kvlt-dev-4r8ncj -f secrets-dev.env

echo ""
echo "Uploading Prod Secrets..."
./upload_secrets.sh -v kvlt-prod-4r8ncj -f secrets-prod.env

echo "All environments completed!"
