import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
interface Task {
  taskId: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  assignedTo: string;
  createdBy: string;
  deadline: string;
  attachments: string[];
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

interface AuthContext {
  userId: string;
  email: string;
  role: string;
  groups: string[];
}

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TASKS_TABLE = process.env.TASKS_TABLE!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const authContext: AuthContext = {
      userId: event.requestContext.authorizer?.userId,
      email: event.requestContext.authorizer?.email,
      role: event.requestContext.authorizer?.role,
      groups: JSON.parse(event.requestContext.authorizer?.groups || '[]'),
    };

    const method = event.httpMethod;
    const pathParams = event.pathParameters;

    switch (method) {
      case 'GET':
        return await getTasks(authContext);
      case 'POST':
        return await createTask(JSON.parse(event.body || '{}'), authContext);
      case 'PUT':
        return await updateTask(pathParams?.taskId!, JSON.parse(event.body || '{}'), authContext);
      case 'DELETE':
        return await deleteTask(pathParams?.taskId!, authContext);
      default:
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
};

async function getTasks(auth: AuthContext) {
  const command = new ScanCommand({ TableName: TASKS_TABLE });
  const result = await docClient.send(command);
  
  let tasks = result.Items as Task[];
  
  // Role-based filtering
  if (auth.role === 'Viewer') {
    tasks = tasks.filter(task => task.assignedTo === auth.userId);
  } else if (auth.role === 'Contributor') {
    tasks = tasks.filter(task => task.assignedTo === auth.userId || task.createdBy === auth.userId);
  }
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ success: true, data: tasks }),
  };
}

async function createTask(taskData: Partial<Task>, auth: AuthContext) {
  if (auth.role === 'Viewer') {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Insufficient permissions' }),
    };
  }

  const task: Task = {
    taskId: uuidv4(),
    title: taskData.title!,
    description: taskData.description || '',
    status: 'pending',
    assignedTo: taskData.assignedTo || auth.userId,
    createdBy: auth.userId,
    deadline: taskData.deadline!,
    attachments: [],
    priority: taskData.priority || 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: TASKS_TABLE,
    Item: task,
  }));

  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ success: true, data: task }),
  };
}

async function updateTask(taskId: string, updates: Partial<Task>, auth: AuthContext) {
  const getCommand = new GetCommand({
    TableName: TASKS_TABLE,
    Key: { taskId },
  });
  
  const existing = await docClient.send(getCommand);
  if (!existing.Item) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Task not found' }),
    };
  }

  const task = existing.Item as Task;
  
  // Permission check
  if (auth.role === 'Viewer' || 
      (auth.role === 'Contributor' && task.createdBy !== auth.userId && task.assignedTo !== auth.userId)) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Insufficient permissions' }),
    };
  }

  const updatedTask = { ...task, ...updates, updatedAt: new Date().toISOString() };
  
  await docClient.send(new PutCommand({
    TableName: TASKS_TABLE,
    Item: updatedTask,
  }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ success: true, data: updatedTask }),
  };
}

async function deleteTask(taskId: string, auth: AuthContext) {
  if (auth.role !== 'Admin') {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Only Admins can delete tasks' }),
    };
  }

  await docClient.send(new DeleteCommand({
    TableName: TASKS_TABLE,
    Key: { taskId },
  }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ success: true }),
  };
}