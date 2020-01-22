# CodePipeline Versioner

This is an AWS SAR component that provides build and version numbering for AWS CodePipeline.

## Introduction

[AWS CodePipeline](https://aws.amazon.com/codepipeline/) is AWS' CD orchestration tool.
We're fans of CodePipeline at [Symphonia](https://www.symphonia.io/) :  we use it with our clients, and on our own projects.
To read a quick overview of CodePipeline see [this blog article](https://blog.symphonia.io/posts/2019-01-21_continuous-integration-continuous-delivery-on-aws) that we wrote.

Most of the time we use CodePipeline in a "Continuous Deployment" scenario - the resources and application to deploy to production are precisely the ones defined within source control at the time the pipeline execution starts.
In this case we're rarely concerned about a version number or a build number - something like 1.0.1, 1.0.2, ... - since we typically only care about the most recent execution, and most recent source code, because [rolling back is a lie](https://blog.skyliner.io/you-cant-have-a-rollback-button-83e914f420d9).

Sometimes, however, we *do* care about tracking such version or build numbers - perhaps because the pipeline is creating an artifact for consumption by other systems,
such as a library (or SAR application!), or perhaps we want to have a [phased release system](https://docs.microsoft.com/en-us/azure/devops/migrate/phase-rollout-with-rings?view=azure-devops). 
At the current time CodePipeline doesn't natively support linearly increasing build numbers, and so we've built this [SAR component](https://aws.amazon.com/serverless/serverlessrepo/) to allow you add such a capability to your CodePipeline pipelines.

## How to use codepipeline-versioner

In these instructions we're assuming that you're using CloudFormation to define your CodePipeline configuration.
We strongly recommend using this "Infrastructure as Code" approach.
If you're defining CodePipeline in a different way, perhaps via the web console, then you should adapt as necessary.

You can also use the [example CloudFormation / SAM template that we provide for this component](https://github.com/symphoniacloud/codepipeline-versioner/blob/master/example-pipeline/pipeline.yaml) that you can copy and paste from.

First, make sure you've included the SAM transform in your CloudFormation template - we normally put it as the second line:

```yaml
Transform: AWS::Serverless-2016-10-31
```

Next, in the `Resources` section of your template, add a SAR resource as follows:

```yaml
  Versioner:
    Type: AWS::Serverless::Application
    Properties:
      Location:
        ApplicationId: arn:aws:serverlessrepo:us-east-1:073101298092:applications/codepipeline-versioner
        SemanticVersion: 1.0.0
```

Now, somewhere early in your `AWS::CodePipeline::Pipeline` 's `Stages` list, create a _Lambda action_ that will call the Versioner:

```yaml
- Name: IncrementVersion
  # This "Namespace" is how we can later reference variables set in the Lambda function
  Namespace: Versioner
  ActionTypeId:
    Category: Invoke
    Owner: AWS
    Version: 1
    Provider: Lambda
  Configuration:
  # "Versioner" here must be the same name as the SAR application resource name above
    FunctionName: !GetAtt Versioner.Outputs.LambdaFunction
```

The IAM Role that your CodePipeline assumes should have sufficient privileges to run the Lambda function in the SAR app.

After this action has run, the following _Variables_ will be available in the `Versioner` namespace (assuming you've not changed the `Namespace` configuration defined above)

* `buildNumber` - an integer that is the value one more than during the previous pipeline execution
* `version` - The `buildNumber` value, with a prefix as specified in the SAR component configuration (see below).

CodePipeline _Variables_ can be used by various other actions. See the CodePipeline [documentation](https://docs.aws.amazon.com/codepipeline/latest/userguide/actions-variables.html) for more details. As an example, you may want to set environment variables for a CodeBuild action, as follows:

```yaml
- Name: CodeBuildSample
  ActionTypeId:
    Category: Build
    Owner: AWS
    Version: 1
    Provider: CodeBuild
  InputArtifacts:
    - Name: SourceCode
  Configuration:
    ProjectName: !Ref CodeBuildSample
    # Here we capture both the 'buildNumber' and 'version' values produced by the Versioner (in the "Versioner" namespace configured earlier)
    # Typically you'd probably only want to use one of these
    EnvironmentVariables: '[{"name":"BUILD_NUMBER","value":"#{Versioner.buildNumber}"},{"name":"VERSION","value":"#{Versioner.version}"}]'
```

And that's it. Now you have a CodePipeline that has a linearly increasing build number and/or version that you can use to generate semantically versioned libraries, versioned application deployment artifacts, and more.

## Optional configuration

The `codepipeline-versioner` component works without any configuration, using the following default behavior:

* The first build number set when using the component in a particular pipeline is 0
* The `version` is of the format `1.0.${buildNumber}` - in other words the _version prefix_ will be `1.0.`
* The build number will be persisted to an S3 bucket created by the SAR app, in an object named `buildNumber.txt`

These defaults can be overridden using a `Parameters` section in the application configuration, e.g.:

```yaml
  Versioner:
    Type: AWS::Serverless::Application
    Properties:
      Location:
        # ...  same details as described above
      Parameters:
        VersionPrefix: 0.0.
```

The following `Parameters` are available:

| Name          | Default           | Description  |
| ------------- |:-------------:| -----|
| `VersionPrefix` | 1.0. | Prefix prepended to `buildNumber` when generating `version` . |
| `StartBuildNumber` | 0 | Value used for `buildNumber` when no saved build number is found. To reset the pipeline's build number to something else, delete the persisted value from S3, and set this value. |
| `BuildNumberKey` | buildNumber.txt | Key of the object persisted to S3 to save build number across executions |

## Conclusion

This SAR app provides a way to enable build numbers / versions in CodePipeline, in a way that integrates well with a CloudFormation infrastructure definition.

If you find this component useful, please let us know at [Twitter](https://twitter.com/symphoniacloud), or email us at [`mikeandjohn@symphonia.io`](mailto:mikeandjohn@symphonia.io) (or just use Github.)