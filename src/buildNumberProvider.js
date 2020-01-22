const AWS = require('aws-sdk'),
      s3 = new AWS.S3(),
      codepipeline = new AWS.CodePipeline();

exports.handler = async function (event, context) {
  try {
    const successResponse = await generateCodePipelineMessage(event);
    await notifyCodePipelineOfSuccess(successResponse);
  }
  catch (error) {
    await notifyCodePipelineOfFailure(event, context, error);
  }
};

async function generateCodePipelineMessage(event) {
  const bucket = process.env.BUCKET_NAME;
  const key = process.env.BUILD_NUMBER_KEY;
  const versionPrefix = process.env.VERSION_PREFIX;
  console.log(`Using following bucket to store build number files: ${bucket}`)
  const previousBuildNumber = await readPreviousBuildNumber(bucket, key);
  const currentBuildNumber = previousBuildNumber + 1;
  console.log(`Build number is ${currentBuildNumber}`);
  await writeBuildNumberToS3(bucket, key, currentBuildNumber);
  return {
    jobId: event["CodePipeline.job"].id,
    outputVariables: {
      buildNumber: `${currentBuildNumber}`,
      version: `${versionPrefix}${currentBuildNumber}`
    }
  }
}

async function readPreviousBuildNumber(bucket, key) {
  if (! await buildNumberFileExists(bucket, key)) {
    console.log(`Unable to find previous build number, so starting from ${process.env.START_BUILD_NUMBER}`)
    // '-1' since we're going to increment it for this current build
    return parseInt(process.env.START_BUILD_NUMBER) - 1
  }
  else {
    const response = await s3.getObject({
      Bucket: bucket,
      Key: key,
    }).promise();

    const previousBuildNumber = response.Body.toString();
    console.log(`Previous Build Number: ${previousBuildNumber}`)
    return parseInt(previousBuildNumber);
  }
}

async function buildNumberFileExists(bucket, key) {
  const response = await s3.listObjectsV2({Bucket: bucket, Prefix: key}).promise();
  return response.Contents.some(({Key}) => Key == key)
}

async function writeBuildNumberToS3(bucket, key, currentBuildNumber) {
  await s3.putObject({
    Bucket: bucket,
    Key: key,
    Body: Buffer.from(`${currentBuildNumber}`)
  }).promise();
}

async function notifyCodePipelineOfSuccess(successResponse) {
  console.log("CodePipeline action successful, posting following to Code Pipeline");
  console.log(JSON.stringify(successResponse))
  await codepipeline.putJobSuccessResult(successResponse).promise();
}

async function notifyCodePipelineOfFailure(event, context, error) {
  console.log(`CodePipeline action failed: ${error}`);
  await codepipeline.putJobFailureResult({
    jobId: event["CodePipeline.job"].id,
    failureDetails: {
      message: JSON.stringify(`CodePipeline action failed: ${JSON.stringify(error)}`),
      type: 'JobFailed',
      externalExecutionId: context.invokeid
    }
  }).promise();
}