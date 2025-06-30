import { APIGatewayRequestAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID!,
  tokenUse: 'access',
  clientId: null,
});

export const handler = async (event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  try {
    const token = event.headers?.Authorization?.replace('Bearer ', '');
    if (!token) throw new Error('No token provided');

    const payload = await verifier.verify(token);
    const groups = payload['cognito:groups'] || [];
    
    return {
      principalId: payload.sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: event.methodArn,
        }],
      },
      context: {
        userId: payload.sub as string,
        email: payload.email as string,
        role: (groups[0] as string) || 'Viewer',
        groups: JSON.stringify(groups),
      },
    };
  } catch (error) {
    throw new Error('Unauthorized');
  }
};