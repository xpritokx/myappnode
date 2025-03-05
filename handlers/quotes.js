const excelDateConvertor = require('../helpers/excel-date-convertor');

const getQuotes = async (req, res, next) => {
    const q = req.query;
    const pageSize = q.pageSize || 25;
    const pageIndex = q.pageIndex || 0;
    const sortingColumn = q.sortingColumn || 'OrderDate'
    const sortingDirection = q.sortingDirection || 'desc';
    const searchField = q.searchField;
    const searchDateField = q.searchDateField;
    const from = q.from;
    const to = q.to;
    const search = q.search;
    let whereStatement = `WHERE`;
    
    if (searchField) {
        whereStatement += ` ${searchField} LIKE '%${search}%'`;
    }

    if (searchDateField) {
        let changedFrom = excelDateConvertor.dateInDays(from);
        let changedTo = excelDateConvertor.dateInDays(to);

        if (whereStatement.length !== 5) whereStatement += ' AND';
 
        if (searchDateField === 'ShipDate') {
            whereStatement += ` ${searchDateField} > {d '${changedFrom}'} AND ${searchDateField} <= {d '${changedTo}'}`;
        } else {
            whereStatement += ` ${searchDateField} > ${changedFrom} AND ${searchDateField} < ${changedTo}`;
        }

    }

    let searchCountQuery;

    if (whereStatement) {
        searchCountQuery = `
            SELECT 
                COUNT(DISTINCT QuotesTableView.OrderNum) AS 'total' 
            FROM QuotesTableView
            ${whereStatement.length === 5 ? '' : whereStatement}
        `;
    } else {
        searchCountQuery = `
            SELECT 
                COUNT(DISTINCT QuotesTableView.OrderNum) AS 'total' 
            FROM QuotesTableView
        `;
    }

    const searchQuery = `
        SELECT
            QuotesTableView.ID,
            QuotesTableView.OrderNum, 
            QuotesTableView.OrderDate,
            QuotesTableView.DeliveryDate,
            QuotesTableView.Address,
            QuotesTableView.JobNum,
            QuotesTableView.PONum,
            QuotesTableView.StairsNum,
            QuotesTableView.InputBy,
            QuotesTableView.PublicComment,
            QuotesTableView.Model,
            QuotesTableView.Customer,
            QuotesTableView.CustomerID,
            QuotesTableView.WorkorderComments,
            QuotesTableView.CustomDelivery
        FROM QuotesTableView
        ${whereStatement.length === 5 ? '' : whereStatement}
        ORDER BY ${sortingColumn} ${sortingDirection}
        OFFSET ${ pageSize * pageIndex } ROWS FETCH NEXT ${pageSize} ROWS ONLY;
    `;

    console.log('--DEBUG-- searchQuery: ', searchQuery)
    console.log('--DEBUG-- searchCountQuery: ', searchCountQuery)


    Promise.all([
        req.app.settings.db.query(searchCountQuery),
        req.app.settings.db.query(searchQuery)
    ]).then(result => {
        const total = result[0].recordset[0].total;
        let data = result[1].recordset;

        data = excelDateConvertor.daysInDate(data, [
            'OrderDate',
            'DeliveryDate',
        ]);

        data = data.map(item => {
            if (item.ShipDate) item.ShipDate = new Date(item.ShipDate).toDateString();
            return item;
        });

        return res.status(200).send({
            status: 'ok',
            total: total,
            data: data,
        });
    }).catch(err => {
        return res.status(400).send({
            status: 'error',
            error: 'Error happened during \'Getting quotes\' DB operation',
            message: err.message
        });
    });
};

module.exports = {
    getQuotes,
}