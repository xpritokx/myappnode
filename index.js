
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require("cors");

const routes = require('./routes/index');
const authRoutes = require('./routes/auth');
const ordersRoutes = require('./routes/orders');
const modelsRoutes = require('./routes/models');
const customersRoutes = require('./routes/customers');

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
    "user": "roman", // Database username
    "password": "5356250", // Database password
    "server": "192.168.1.155", // Server IP address
    "database": "stairs", // Database name
    "options": {
        "encrypt": false // Disable encryption
    }
}

const config_stairs_server_db = {
    "user": "roman", // Database username
    "password": "5356250", // Database password
    "server": "192.168.1.155", // Server IP address
    "database": "stairs_server", // Database name
    "options": {
        "encrypt": false // Disable encryption
    }
}

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

app.use('/', routes);
app.use('/api/auth', authRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/customers', customersRoutes);

app.listen(port, () => {
    console.log(`Now listening on port ${port}`); 
});