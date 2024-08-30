const express = require('express');
const router = express.Router();
const { DataSource } = require('typeorm');
const { SqlDatabase } = require('langchain/sql_db');
const multer = require('multer');
const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');
const { Sequelize } = require('sequelize');


const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'private-sqlite.db'
});


async function getTableNames(table_Name) {
  try {
    // Authenticate to make sure the connection is successful
    await sequelize.authenticate();

    // Retrieve all table names from the database
    const tables = await sequelize.getQueryInterface().showAllTables();
    console.log('Tables-------------------------------------:', tables);

    // Check if a specific table exists
    const tableName = table_Name; // Replace with the table name you are looking for
    const tableExists = tables.includes(tableName);
    if (tableExists) {
      console.log(`Table '${tableName}' exists.`);
      return true
    } else {
      console.log(`Table '${tableName}' does not exist.`);
      return false
    }
  } catch (error) {
    console.error('Error:', error);
  }
}


// Function to read file asynchronously
function readFileAsync(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) reject(err);
      resolve(data);
    });
  });
}

async function importCsvToDatabase(db, csvFilePath) {

  try {
    const fileNameGet = csvFilePath.split('/').pop(); // Get just the filename part
    const tableName = fileNameGet.split('-').slice(1).join('-').replace('.csv', '')

    const fileContent = await readFileAsync(csvFilePath);

    const { data: records, errors, meta } = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true
    });


    if (records.length === 0) {
      console.log("No data found in the CSV file.");
      return;
    } ``

    // Get column names and types
    const columns = Object.keys(records[0]);
    console.log("----columnscolumnscolumns--------------------------", columns)
    // const columnDefinitions = columns.map(col => `${col} TEXT`).join(', ');
    const columnDefinitions = columns.map(col => {
      // Replace spaces with underscores and ensure the column type is TEXT
      const cleanColumnName = col.replace(/ /g, '_').toUpperCase();
      return `${cleanColumnName} TEXT`;
    }).join(', ');

    const check_tables = await getTableNames(tableName)

    if (!check_tables) {

      const createTableQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefinitions})`;
      await db.run(createTableQuery);

      const columns_list = columnDefinitions.split(', ').map(def => def.split(' ')[0]);

      for (const record of records) {
        const columns = Object.keys(record);
        const values = Object.values(record);
        const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");

        const insertQuery = `INSERT INTO ${tableName} (${columns_list.join(", ")}) VALUES (${placeholders})`;

        const finalQuery = insertQuery.replace(/\$\d+/g, (match) => {
          const index = parseInt(match.slice(1)) - 1;
          const value = values[index];
          const sanitizedValue = value !== undefined && value !== null ? value.toString().replace(/'/g, "''") : '';
          return `'${sanitizedValue}'`;
        });
        await db.run(finalQuery);
      }
    } else {
      console.log(`Table---------------------------------------------------------- '${tableName}' exists.`);
    }

  } catch (error) {
    console.error('Error importing CSV:', error);
  }
}


// Set up multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // Limiting file size to 30MB
});

const uploadDir = path.join(__dirname, 'uploads');


// Ensure uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}


// Function to create and return a database connection
async function createDatabase() {
  try {
    const datasource = new DataSource({
      "type": "sqlite",
      "database": "private-sqlite.db",
    });

    await datasource.initialize();
    return SqlDatabase.fromDataSourceParams({ appDataSource: datasource });
  } catch (error) {
    console.error('Error creating database:', error);
    throw error;
  }
}


router.post('/getdata', async (req, res, next) => {
  next();
}, upload.array('myFiles', 10), async (req, res) => {
  try {

    // Log the uploaded files
    console.log("Files uploaded:", req.files);
    console.log("Payload received:", req.body);

    // this.log("Files uploaded:", req.files);
    // this.log("Payload received:", req.body);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files were uploaded.' });
    }

    const db = await createDatabase();

    const importPromises = req.files.map(async (filePath) => {
      try {
        console.log(`Importing CSV file: ${filePath.path}`);
        await importCsvToDatabase(db, filePath.path);
        return { filePath: filePath.path, success: true };
      } catch (error) {
        console.error(`Error importing CSV file: ${filePath.path}`, error);
        return { filePath: filePath.path, success: false, error };
      }
    });

    // Wait for all import operations to complete
    const importResults = await Promise.all(importPromises);

    // Check the results and provide feedback
    const allSuccessful = importResults.every(result => result.success);

    if (allSuccessful) {
      console.log("All files imported successfully.");
      return res.json({ message: 'Data fetched successfully', statusCode: 200 });
    } else {
      console.log("Some files failed to import:");
      return res.json({ message: 'Data fetched failed', statusCode: 204 });
    }


  } catch (error) {
    console.error('Failed to fetch data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});


router.get('/gettableinfo', async (req, res) => {
  try {
    await sequelize.authenticate();
    // Retrieve all table names from the database
    const tables = await sequelize.getQueryInterface().showAllTables();
    console.log('Tables-------------------------------------:', tables);
    res.status(200).json(tables);
  } catch (error) {
    // Handle errors
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/deletedata', async (req, res) => {
  try {
    const tableName = req.body.tableName;
    //  const tableName = nameReq.split('-').join('-').replace('.csv','');
    console.log("TABLE NAME-----------------------------", tableName);
    if (!tableName) {
      return res.status(400).json({ error: 'Table name is required' });
    }

    const dropQuery = `DROP TABLE \`${tableName}\``;
    const db = await createDatabase();

    await db.run(dropQuery);
    res.json({ message: 'Table data truncated successfully', status_code: 200 });
  } catch (error) {
    console.error('Error in /deletedata route:', error);
    res.status(500).json({ error: 'Failed to delete table data', status_code: 202 });
  }
});


module.exports = router;
