const excelDateConvertor = require('../helpers/excel-date-convertor');
const getQueries = require('../queries');

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

const duplicate = async (req, res, next) => {
    const body = req.body;
    const params = req.params;
    const orderNum = body.orderNum;
    const action = params.action;

    let workorders;
    let workordersExtensions;
    let uncomplete;


    console.log('--DEBUG-- duplicate: ', orderNum);

    const getWorkordersQuery = `
        SELECT *
        FROM Quotes
        WHERE OrderNum=${orderNum}
    `;

    const getWorkorderExtensionsQuery = `
        SELECT *
        FROM WorkOrderExtensions
        WHERE WONum=${orderNum}
    `;

    const getUncompleteQuery = `
        SELECT *
        FROM stairs_server.dbo.Uncomplete
        WHERE WONUM=${orderNum}
    `;
    
    let results = await Promise.all([
        req.app.settings.db.query(getWorkordersQuery),
        req.app.settings.db.query(getWorkorderExtensionsQuery),
        req.app.settings.db.query(getUncompleteQuery),
    ]);

    workorders = results[0] && results[0].recordset;
    workordersExtensions = results[1] && results[1].recordset;
    uncomplete = results[2] && results[2].recordset;

    if (action === 'duplicate') {
        // TAKING INFORMATION TO CREATE NEW ID AND ORDER NUM

        const takeLastIdQuery = `
            SELECT TOP 1 Quotes.ID
            FROM Quotes
            ORDER BY Quotes.ID DESC
        `;

        const lastOrderID = await req.app.settings.db.query(takeLastIdQuery);

        let id = lastOrderID.recordset[0].ID;
        let newOrderNum;

        console.log('--DEBUG-- new id: ', id);

        const takeLastOrderNumQuery = `
            SELECT TOP 1 Quotes.OrderNum
            FROM Quotes
            ORDER BY Quotes.OrderNum DESC
        `;

        const lastOrderNum = await req.app.settings.db.query(takeLastOrderNumQuery);
        
        newOrderNum = lastOrderNum.recordset[0].OrderNum;

        console.log('--DEBUG-- highest order num: ', newOrderNum);
        newOrderNum++;

        //////////////////////////////////////////////////////////////////////////////

        if (workorders && workorders.length) {
            try {
                for (let workorder of workorders) {
                    id++;
                    workorder['NewID'] = id;
                    workorder['NewOrderNum'] = newOrderNum;
                    workorder['TableName'] = 'Quotes';

                    let workorderCreateQuery = getQueries(workorder, 'createFullWorkorder');
        
                    await req.app.settings.db.query(workorderCreateQuery);
                    console.log(`--DEBUG-- workorder ${newOrderNum} with id ${id} was created;`);
                    
                    const workorderExt = workordersExtensions.find(wExt => wExt.WOID === workorder.ID);
    
                    if (workorderExt) {
                        workorderExt['NewID'] = id;
                        workorderExt['NewOrderNum'] = newOrderNum;

                        let workordersExtensionCreateQuery = getQueries(workorderExt, 'createFullWorkorderExtension');
            
                        await req.app.settings.db.query(workordersExtensionCreateQuery);
                        console.log(`--DEBUG-- workorder extension ${newOrderNum} with id ${id} was created;`);
                    }

                    const uncompleteItem = uncomplete.find(c => c.WOID === workorder.ID);
    
                    if (uncompleteItem) {
                        uncompleteItem['NewID'] = id;
                        uncompleteItem['NewOrderNum'] = newOrderNum;
    
                        let uncompleteOrderCreateQuery = getQueries(uncompleteItem, 'createFullUncomplete');
            
                        console.log('--DEBUG-- uncompleted query is ready! ', uncompleteOrderCreateQuery);

                        await req.app.settings.db.query(uncompleteOrderCreateQuery);
                        console.log(`--DEBUG-- uncomplete order ${newOrderNum} with id ${id} was created;`);
                    }
                }

                return res.status(200).send({
                    status: 'ok'
                });
            } catch (err) {
                return res.status(400).send({
                    status: 'error',
                    message: err.message,
                    error: 'Error happened during \'Duplicating order\' DB operation',
                });
            }
        } else {
            return res.status(400).send({
                status: 'error',
                message: err.message,
                error: 'Workorders with such Order ID doesn`t exists',
            });
        }
    }

    if (action === 'convert') {
        // TAKING INFORMATION TO CREATE NEW ID AND ORDER NUM

        const takeLastIdQuery = `
            SELECT TOP 1 Workorders.ID
            FROM Workorders
            ORDER BY Workorders.ID DESC
        `;

        const lastOrderID = await req.app.settings.db.query(takeLastIdQuery);

        let id = lastOrderID.recordset[0].ID;
        let newOrderNum;

        console.log('--DEBUG-- new id: ', id);

        const takeLastOrderNumQuery = `
            SELECT TOP 1 Workorders.OrderNum
            FROM Workorders
            ORDER BY Workorders.OrderNum DESC
        `;

        const lastOrderNum = await req.app.settings.db.query(takeLastOrderNumQuery);
        
        newOrderNum = lastOrderNum.recordset[0].OrderNum;

        console.log('--DEBUG-- highest quote num: ', newOrderNum);
        newOrderNum++;

        //////////////////////////////////////////////////////////////////////////////


        if (workorders && workorders.length) {
            try {
                for (let workorder of workorders) {
                    id++;
                    workorder['NewID'] = id;
                    workorder['NewOrderNum'] = newOrderNum;
                    workorder['TableName'] = 'Workorders';

                    let workorderCreateQuery = getQueries(workorder, 'createFullWorkorder');
        
                    console.log('--DEBUG-- new query to create quote is ready! ', workorderCreateQuery);

                    await req.app.settings.db.query(workorderCreateQuery);
                    console.log(`--DEBUG-- quote ${newOrderNum} with id ${id} was created;`);
                    
                    const workorderExt = workordersExtensions.find(wExt => wExt.WOID === workorder.ID);
    
                    if (workorderExt) {
                        workorderExt['NewID'] = id;
                        workorderExt['NewOrderNum'] = newOrderNum;

                        let workordersExtensionCreateQuery = getQueries(workorderExt, 'createFullWorkorderExtension');
            
                        await req.app.settings.db.query(workordersExtensionCreateQuery);
                        console.log(`--DEBUG-- workorder extension for quote ${newOrderNum} with id ${id} was created;`);
                    }
    
                    const uncompleteItem = uncomplete.find(c => c.WOID === workorder.ID);
    
                    if (uncompleteItem) {
                        uncompleteItem['NewID'] = id;
                        uncompleteItem['NewOrderNum'] = newOrderNum;
    
                        let uncompleteOrderCreateQuery = getQueries(uncompleteItem, 'createFullUncomplete');
            
                        await req.app.settings.db.query(uncompleteOrderCreateQuery);
                        console.log(`--DEBUG-- uncomplete quote ${newOrderNum} with id ${id} was created;`);
                    } else {
                        let createUncompleteQuery = getQueries({
                            id: id,
                            orderNum: newOrderNum,
                            deliveryDate: workorder.DeliveryDate,
                            location: workorder.Location
                        }, 'createUncomplete');

                        await req.app.settings.db.query(createUncompleteQuery);
                        
                        console.log(`--DEBUG-- new uncomplete quote ${newOrderNum} with id ${id} was created;`);
                    }
                }

                // DELETING ORDER THAT WAS CONVERTED

                let deleteUncomplete;
                let deleteOrderExtensionsQuery;
                let deleteOrdersQuery;

                console.log(`--DEBUG-- order with number: ${orderNum} will be deleted`);

                try {
                    deleteUncomplete = `DELETE FROM stairs_server.dbo.Uncomplete WHERE WONUM=${orderNum}`;
                    deleteOrderExtensionsQuery = `DELETE FROM WorkOrderExtensions WHERE WONum=${orderNum}`;
                    deleteOrdersQuery = `DELETE FROM Quotes WHERE OrderNum=${orderNum}`;
                
                    await Promise.all([
                        req.app.settings.db.query(deleteUncomplete),
                        req.app.settings.db.query(deleteOrdersQuery),
                        req.app.settings.db.query(deleteOrderExtensionsQuery),
                    ]);
                    console.log(`--DEBUG-- quotes with number: ${orderNum} were deleted`);
                } catch (err) {
                    return res.status(400).send({
                        status: 'error',
                        message: err.message,
                        error: 'Error happened during \'Deleting quote\' DB operation',
                    });
                }

                //////////////////////////////////////////////////////////////////////////////

                return res.status(200).send({
                    status: 'ok'
                });
            } catch (err) {
                return res.status(400).send({
                    status: 'error',
                    message: err.message,
                    error: 'Error happened during \'Duplicating quote\' DB operation',
                });
            }
        } else {
            return res.status(400).send({
                status: 'error',
                message: err.message,
                error: 'Quotes with such Order ID doesn`t exists',
            });
        }
    }

    return res.status(400).send({
        status: 'error',
        message: err.message,
        error: 'Choose correct action!',
    });
}

module.exports = {
    getQuotes,
    duplicate,
}