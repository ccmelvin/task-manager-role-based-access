#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TaskManagerStack } from '../lib/task-manager-stack';

const app = new cdk.App();
new TaskManagerStack(app, 'TaskManagerStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});