require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Function to recursively find and mount all Vercel serverless functions in the api folder
const mountApiRoutes = (dir, baseRoute = '/api') => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      mountApiRoutes(fullPath, `${baseRoute}/${file}`);
    } else if (file.endsWith('.js') || file.endsWith('.ts')) {
      const routePath = `${baseRoute}/${file.replace(/\.(js|ts)$/, '')}`;
      try {
        const handler = require(fullPath);
        // Vercel routes export a single handler function
        if (typeof handler === 'function') {
          app.all(routePath, handler);
          console.log(`Mounted route: ${routePath}`);
        } else if (handler.default && typeof handler.default === 'function') {
          app.all(routePath, handler.default);
          console.log(`Mounted route: ${routePath}`);
        }
      } catch (err) {
        console.error(`Error mounting route ${routePath}:`, err);
      }
    }
  }
};

try {
  const apiDir = path.join(__dirname, 'api');
  mountApiRoutes(apiDir);
  console.log('All API routes mounted successfully.');
} catch (err) {
  console.error('Error mounting API routes:', err);
}

const port = 3000;
app.listen(port, () => {
  console.log(`Backend local dev server listening on http://localhost:${port}`);
});
