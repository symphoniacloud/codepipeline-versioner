#!/bin/sh

if [[ $# -ne 2 ]]; then
    echo "Invalid number of arguments"
    echo
    echo "usage:"
    echo "$ ./publish.sh SAM_BUCKET SEMANTIC_VERSION"
    echo
    exit 2
fi

sam build

cd .aws-sam/build

sam package \
    --region us-east-1 \
    --template-file template.yaml \
    --output-template-file packaged.yaml \
    --s3-bucket $1

sam publish \
    --region us-east-1 \
    --semantic-version $2 \
    --template packaged.yaml
