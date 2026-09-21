const allowCors = (handler) => async (req, res) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://teamshadowkai.com',
    'https://www.teamshadowkai.com',
    process.env.FRONTEND_PRODUCTION_URL
  ].filter(Boolean);

  const origin = req.headers.origin;
  
  if (origin) {
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0] || '*');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-CloudTasks-QueueName, ngrok-skip-browser-warning'
  );
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  return await handler(req, res);
};

module.exports = { allowCors };
