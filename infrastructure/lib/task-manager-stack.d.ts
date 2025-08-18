import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
export declare class TaskManagerStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
    /**
     * Get CORS origins based on environment
     */
    private getCorsOrigins;
}
