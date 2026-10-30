const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const LOCAL_URI = 'mongodb://localhost:27017';
const ATLAS_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const DB_NAME = 'SPM_banking_application';

async function migrate() {
  if (!ATLAS_URI) throw new Error('MONGO_URI is not set in backend/.env');
  console.log('Connecting to local MongoDB...');
  const localClient = new MongoClient(LOCAL_URI);
  await localClient.connect();
  const localDb = localClient.db(DB_NAME);

  console.log('Connecting to MongoDB Atlas...');
  const atlasClient = new MongoClient(ATLAS_URI);
  await atlasClient.connect();
  const atlasDb = atlasClient.db(DB_NAME);

  try {
    const collections = await localDb.listCollections().toArray();
    
    for (let collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`\nMigrating collection: ${collectionName}...`);
      
      const localCollection = localDb.collection(collectionName);
      const atlasCollection = atlasDb.collection(collectionName);
      
      const documents = await localCollection.find({}).toArray();
      
      if (documents.length === 0) {
        console.log(`- Collection ${collectionName} is empty, skipping.`);
        continue;
      }
      
      console.log(`- Found ${documents.length} documents.`);
      
      // We will try to insert documents one by one to handle duplicates gracefully
      let inserted = 0;
      let duplicates = 0;
      
      for (const doc of documents) {
        try {
          await atlasCollection.insertOne(doc);
          inserted++;
        } catch (err) {
          if (err.code === 11000) { // Duplicate key error
            duplicates++;
          } else {
            console.error(`- Error inserting document ${doc._id}:`, err.message);
          }
        }
      }
      
      console.log(`- Successfully inserted ${inserted} documents. Skipped ${duplicates} duplicates.`);
    }
    
    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await localClient.close();
    await atlasClient.close();
  }
}

migrate();
