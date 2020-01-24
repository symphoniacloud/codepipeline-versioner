#!/bin/sh

sam deploy \
    --region us-east-1 \
    --template pipeline.yaml \
    --stack-name codepipeline-versioner-pipeline \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND