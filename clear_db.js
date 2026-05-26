/**
 * Utility script to clear all Business documents from the database.
 * Usage: node clear_db.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Business = require('./models/Business');

const clearDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('Connected to MongoDB');

    const result = await Business.deleteMany({});
    console.log(`Deleted ${result.deletedCount} business record(s).`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
    process.exit(0);
  }
};

clearDB();
