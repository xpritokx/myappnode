let getCustomers = async (req, res, next) => {
    const q = req.query;
    const name = q.customer || '';
    let whereStatement = ``;

    let searchCustomersQuery;

    if (name) {
        whereStatement = `WHERE Customers.Name LIKE '%${name}%'`;
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

module.exports = {
    getCustomers,
}