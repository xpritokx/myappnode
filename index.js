
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require("cors");

require('dotenv').config('.env');

const routes = require('./routes/index');
const authRoutes = require('./routes/auth');
const ordersRoutes = require('./routes/orders');
const quotesRoutes = require('./routes/quotes');
const modelsRoutes = require('./routes/models');
const pricesRoutes = require('./routes/prices');
const customersRoutes = require('./routes/customers');
const stairTypesRoutes = require('./routes/stairTypes');
const stairStylesRoutes = require('./routes/stairStyles');
const stringerStylesRoutes = require('./routes/stringerStyles');
const riserTypesRoutes = require('./routes/riserTypes');
const materialsRoutes = require('./routes/materials');

const authHandler = require('./handlers/auth'); 

const sql = require("mssql");
const app = express();
const port = 8000;

const corsOptions ={
    origin:'*', 
    credentials:true,            //access-control-allow-credentials:true
    optionSuccessStatus:200,
}

// SQL Server configuration
const config_stairs_db = {
    "user": process.env.STAIRS_DB_USER, // Database username
    "password": process.env.STAIRS_DB_PASS, // Database password
    "server": process.env.STAIRS_DB_SERVER, // Server IP address
    "database": process.env.STAIRS_DB_NAME, // Database name
    "options": {
        "encrypt": false // Disable encryption
    },
    "pool": {
        "max": 10,
        "min": 0,
        "idleTimeoutMillis": 30000
    },
}

const config_stairs_server_db = {
    "user": process.env.STAIRS_SERVER_DB_USER, // Database username
    "password": process.env.STAIRS_SERVER_DB_PASS, // Database password
    "server": process.env.STAIRS_SERVER_DB_SERVER, // Server IP address
    "database": process.env.STAIRS_SERVER_DB_NAME, // Database name
    "options": {
        "encrypt": false // Disable encryption
    }
}

app.use(bodyParser({limit: '2mb'}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to SQL Server
sql.connect(config_stairs_db, err => {
    if (err) {
        throw err;
    }
    console.log("Connection to stairs DB is Successful!");
});

sql.connect(config_stairs_server_db, err => {
    if (err) {
        throw err;
    }
    console.log("Connection to stairs_server DB is Successful!");
});


app.use(cors(corsOptions));

app.post('/api/auth', (req, res) => { 
    authHandler.check(req, res);
});

app.set('db', sql);
app.set('loggedUsers: ', {});

app.use('/', routes);
app.use('/api/auth', authRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/prices', pricesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/stairTypes', stairTypesRoutes);
app.use('/api/riserTypes', riserTypesRoutes);
app.use('/api/stairStyles', stairStylesRoutes);
app.use('/api/stringerStyles', stringerStylesRoutes);

app.listen(port, () => {
    console.log(`Now listening on port ${port}`);
});