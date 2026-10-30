const mongoose = require('mongoose');

const connectDB = async () => {
  // All customer data lives in MongoDB Atlas; refuse to start against anything else silently.
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGO_URI is not set. Add your MongoDB Atlas connection string to backend/.env');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host} (db: ${conn.connection.name})`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
