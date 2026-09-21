module.exports = (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'Shadow Kai API is running successfully on Vercel Serverless',
    timestamp: new Date().toISOString()
  });
};
