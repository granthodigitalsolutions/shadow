const { CloudTasksClient } = require('@google-cloud/tasks');
const logger = require('../utils/logger');

let tasksClient = null;

const getTasksClient = () => {
  if (tasksClient) return tasksClient;

  // Initialize with standard GCP credentials or specific service account
  // If running on Vercel, we can pass credentials explicitly
  try {
    const clientConfig = {};

    const projectId = process.env.GCP_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.GCP_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.GCP_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      const cleanKey = privateKey.replace(/^"/, '').replace(/"$/, '').replace(/\\n/g, '\n').replace(/\r/g, '');
      clientConfig.projectId = projectId.trim();
      clientConfig.credentials = {
        client_email: clientEmail.trim(),
        private_key: cleanKey,
      };
    }

    tasksClient = new CloudTasksClient(clientConfig);
    return tasksClient;
  } catch (error) {
    logger.error('Failed to initialize Google Cloud Tasks Client', { error: error.message });
    throw error;
  }
};

const enqueueTask = async (payload) => {
  const client = getTasksClient();
  const rawProject = process.env.GCP_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const project = rawProject ? rawProject.trim() : null;
  const queue = process.env.GCP_CLOUD_TASKS_QUEUE_NAME ? process.env.GCP_CLOUD_TASKS_QUEUE_NAME.trim() : null;
  const location = process.env.GCP_CLOUD_TASKS_LOCATION ? process.env.GCP_CLOUD_TASKS_LOCATION.trim() : null;
  const url = process.env.WORKER_ENDPOINT_URL ? process.env.WORKER_ENDPOINT_URL.trim() : null;

  if (!project || !queue || !location || !url) {
    if (process.env.NODE_ENV !== 'production') {
      logger.info('Local dev without GCP Cloud Tasks env vars detected. Bypassing queue and sending directly to local worker...');
      try {
        const localUrl = 'http://localhost:3000/api/worker/process-message';
        // Fire and forget the local worker request to simulate background queuing
        fetch(localUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(err => {
          logger.error('Local worker failed in background', { error: err.message });
        });
        return { name: 'local-async-task' };
      } catch (err) {
        logger.error('Failed to send task locally', { error: err.message });
        throw err;
      }
    }
    throw new Error(`Cloud Tasks environment variables missing. project=${project}, queue=${queue}, loc=${location}, url=${url}`);
  }

  const parent = client.queuePath(project, location, queue);

  const rawClientEmail = process.env.GCP_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const serviceAccountEmail = rawClientEmail ? rawClientEmail.trim() : '';

  const task = {
    httpRequest: {
      httpMethod: 'POST',
      url,
      headers: {
        'Content-Type': 'application/json',
      },
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
      oidcToken: {
        serviceAccountEmail,
      },
    },
  };

  try {
    console.log('Sending to parent:', parent);
    console.log('Task object:', JSON.stringify(task, null, 2));
    const [response] = await client.createTask({ parent, task });
    logger.info('Created Google Cloud Task', { taskName: response.name });
    return response;
  } catch (error) {
    logger.error('Failed to create Google Cloud Task', { error: error.message });
    throw error;
  }
};

module.exports = { getTasksClient, enqueueTask };
