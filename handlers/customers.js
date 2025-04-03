const getCustomersForDropdown = async (req, res, next) => {
    const q = req.query;
    const name = q.customer || '';
    let whereStatement = `WHERE Deleted=0`;

    let searchCustomersQuery;

    if (name) {
        whereStatement += ` AND Customers.Name LIKE '%${name}%'`;
    }

    searchCustomersQuery = `
        SELECT Customers.ID, Customers.Name
        FROM Customers
        ${whereStatement}
        ORDER BY Customers.Name ASC
    `;

    const customers = await req.app.settings.db.query(searchCustomersQuery);
    const customersData = customers.recordset.filter(customer => customer.Name);

    return res.status(200).send({
        total: customersData.length,
        data: customersData,
    });
};

const getAllCustomers = async (req, res, next) => {
    const q = req.query;
    const pageSize = q.pageSize || 25;
    const pageIndex = q.pageIndex || 0;
    const sortingColumn = q.sortingColumn || 'OrderDate'
    const sortingDirection = q.sortingDirection || 'asc';
    const searchField = q.searchField;
    const search = q.search;
    let whereStatement = `WHERE Deleted=0`;
    
    if (searchField) {
        whereStatement += ` AND ${searchField} LIKE '%${search}%'`;
    }

    let searchCountQuery;

    if (whereStatement) {
        searchCountQuery = `
            SELECT 
                COUNT(DISTINCT Customers.ID) AS 'total' 
            FROM Customers
            ${whereStatement}
        `;
    } else {
        searchCountQuery = `
            SELECT 
                COUNT(DISTINCT Customers.ID) AS 'total' 
            FROM Customers
            ${whereStatement}
        `;
    }

    const searchQuery = `
        SELECT
            Customers.ID,
            Customers.Name, 
            Customers.Address,
            Customers.Comments,
            Customers.Deck_Material
        FROM Customers
        ${whereStatement}
        ORDER BY ${sortingColumn} ${sortingDirection}
        OFFSET ${ pageSize * pageIndex } ROWS FETCH NEXT ${pageSize} ROWS ONLY;
    `;

    console.log('--DEBUG-- searchQuery customers: ', searchQuery)
    console.log('--DEBUG-- searchCountQuery customers: ', searchCountQuery)

    Promise.all([
        req.app.settings.db.query(searchCountQuery),
        req.app.settings.db.query(searchQuery)
    ]).then(result => {
        const total = result[0].recordset[0].total;
        let data = result[1].recordset;

        return res.status(200).send({
            status: 'ok',
            total: total,
            data: data,
        });
    }).catch(err => {
        return res.status(400).send({
            status: 'error',
            error: 'Error happened during \'Getting customers\' DB operation',
            message: err.message
        });
    });
};

const addCustomer = async (req, res, next) => {
    const body = req.body;
    const name = body.name;

    const takeLastCustomerQuery = `
        SELECT TOP 1 Customers.ID
        FROM Customers
        WHERE Deleted=0
        ORDER BY Customers.ID DESC
    `;

    const checkCustomerWithSameNameQuery = `
        SELECT Customers.Name
        FROM Customers
        WHERE Customers.Name=${name} AND DELETED=0
    `;

    const customerWithSameName = await req.app.settings.db.query(checkCustomerWithSameNameQuery);

    if (customerWithSameName.recordset.length > 0) {
        return res.status(400).send({
            status: 'error',
            message: 'Customers with same name is already exists',
            error: 'Customers with same name is already exists',
        });
    }

    const lastCustomerNumberData = await req.app.settings.db.query(takeLastCustomerQuery);
    const id = lastCustomerNumberData.recordset[0].ID + 1;

    console.log('--DEBUG-- lastCustomerNumberData.recordset[0].ID + 1 ', id);

    const createCustomerQuery = `
        INSERT INTO stairs.dbo.Customers (
            ID,
            Name,
            Address,
            Tier,
            Style_1_Adjust,
            Style_2_Adjust,
            Comments,
            Deck_Tread_Adjust,
            Garage_Tread_Adjust,
            Deck_Material,
            Dealer,
            Deleted,
            SalesMan
        )
        VALUES (
            ${id},
            '${name}',
            '${body.address}',
            1,
            1.5,
            1.5,
            '${body.comments}',
            0,
            0,
            'None',
            0,
            0,
            ''
        )`;
    
    try {
        await req.app.settings.db.query(createCustomerQuery);
    } catch (err) {
        return res.status(400).send({
            status: 'error',
            message: err.message,
            error: 'Error happened during \'Creating customer\' DB operation',
        });
    }

    res.status(200).send({
        status: 'success',
        id,
        name
    });
}

const updateCustomer = async (req, res, next) => {
    const params = req.params;
    const body = req.body;
    const id = params.id;

    const updateCustomerQuery = `
        UPDATE
            stairs.dbo.Customers
        SET
            Name='${body.name}',
            Address='${body.address}',
            Comments='${body.comments}'
        WHERE
            ID=${id}
    `;
    
    try {
        await req.app.settings.db.query(updateCustomerQuery);
    } catch (err) {
        return res.status(400).send({
            status: 'error',
            message: err.message,
            error: 'Error happened during \'Updating customer\' DB operation',
        });
    }

    res.status(200).send({
        status: 'success'
    });
}

const deleteCustomer = async (req, res, next) => {
    const params = req.params;
    const id = params.id;
    let deleteCustomerQuery;

    // deleteCustomerQuery = `DELETE FROM stairs.dbo.Customers WHERE ID=${id}`;
    deleteCustomerQuery = `UPDATE
            stairs.dbo.Customers
        SET
            Deleted=1
        WHERE
            ID=${id}`;

    try {
        await req.app.settings.db.query(deleteCustomerQuery);
    } catch (err) {
        return res.status(400).send({
            status: 'error',
            message: err.message,
            error: 'Error happened during \'Deleting customer\' DB operation',
        });
    }

    return res.status(200).send({
        status: 'ok'
    });
}

module.exports = {
    getCustomersForDropdown,
    getAllCustomers,
    deleteCustomer,
    updateCustomer,
    addCustomer
}