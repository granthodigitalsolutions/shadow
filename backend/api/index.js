// Root status + /api/health (rewritten here by vercel.json so both share one
// serverless function and the project stays within the plan's function limit).
module.exports = (req, res) => {
  res.status(200).json({
    success: true,
    status: 'online',
    message: 'Shadow Kai API is running successfully on Vercel Serverless',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
};
