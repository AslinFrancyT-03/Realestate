const mongoose = require('mongoose');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

const connectDB = async (retryCount = 0) => {
  try {
    // Ensure a database name is present in the URI
    let uri = process.env.MONGODB_URI || '';
    // If the URI ends with '/' or has no path after the host, append a default DB name
    const url = new URL(uri);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/businessListingDB';
      uri = url.toString();
    }

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host} | DB: ${conn.connection.name}`);
  } catch (err) {
    console.error(`MongoDB connection error (attempt ${retryCount + 1}/${MAX_RETRIES}): ${err.message}`);
    if (retryCount < MAX_RETRIES - 1) {
      console.log(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      return connectDB(retryCount + 1);
    }
    console.error('All MongoDB connection attempts failed. Routes will fail gracefully.');
  }
};

module.exports = connectDB;
