const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const connectDB = require('../config/db');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Create Express App
const app = express();

// Set Port
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Database
connectDB();

// Setup logs and folder setups
const uploadsDir = path.join(__dirname, '../uploads');
const publicDir = path.join(__dirname, '../public');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve Frontend client directory as static assets
app.use(express.static(path.join(__dirname, '../client')));
// Serve public directory as static assets
app.use('/public', express.static(publicDir));

// API Routes
app.use('/api/business', require('../routes/businessRoutes'));

// Explicit route for database page
app.get('/database', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/database.html'));
});

// Explicit route for agent details page
app.get('/agents', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/agents.html'));
});

// Catch-all route for any unhandled page request, serves the dashboard
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: err.message
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(` Web App URL: http://localhost:${PORT}`);
  console.log(` API Endpoint: http://localhost:${PORT}/api/business`);
  console.log(`===================================================`);
});
