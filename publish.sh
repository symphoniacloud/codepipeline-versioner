#!/bin/sh

sam build

cd .aws-sam/build

sam package \
    --region us-east-1 \
    --template-file template.yaml \
    --output-template-file packaged.yaml \
    --s3-bucket $1

sam publish \
    --region us-east-1 \
    --semantic-version 1.0.0 \
    --template packaged.yaml
