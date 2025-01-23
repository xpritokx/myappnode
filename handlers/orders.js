const excelDateConvertor = require('../helpers/excel-date-convertor');
const getQueries = require('../queries');

const getOrders = async (req, res, next) => {
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
        let changedFrom = searchDateField === 'ShipDate' ? new Date(from).toISOString().substr(0, 10) : excelDateConvertor.dateInDays(from);
        let changedTo = searchDateField === 'ShipDate' ? new Date(to).toISOString().substr(0, 10) : excelDateConvertor.dateInDays(to);

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
                COUNT(DISTINCT OrdersTableView.OrderNum) AS 'total' 
            FROM OrdersTableView
            ${whereStatement.length === 5 ? '' : whereStatement}
        `;
    } else {
        searchCountQuery = `
            SELECT 
                COUNT(DISTINCT OrdersTableView.OrderNum) AS 'total' 
            FROM OrdersTableView
        `;
    }

    // old search query
    /* const searchQuery = `
            WITH RankedRows AS (
                SELECT
                    OrdersTableView.OrderNum, 
                    OrdersTableView.OrderDate,
                    OrdersTableView.DeliveryDate,
                    OrdersTableView.Address,
                    OrdersTableView.JobNum,
                    OrdersTableView.PONum,
                    OrdersTableView.Status,
                    OrdersTableView.WorkorderComments,
                    OrdersTableView.StairsNum,
                    OrdersTableView.InputBy,
                    OrdersTableView.ShipDate,
                    OrdersTableView.Model,
                    OrdersTableView.Customer,
                    ROW_NUMBER() OVER (PARTITION BY OrderNum ORDER BY OrdersTableView.ID) AS rn
                FROM OrdersTableView
            )
            SELECT 
                RankedRows.OrderNum, 
                RankedRows.OrderDate,
                RankedRows.DeliveryDate,
                RankedRows.Address,
                RankedRows.JobNum,
                RankedRows.PONum,
                RankedRows.Status,
                RankedRows.WorkorderComments,
                RankedRows.StairsNum,
                RankedRows.InputBy,
                RankedRows.ShipDate,
                RankedRows.Model,
                RankedRows.Customer
            FROM RankedRows
            WHERE rn = 1 ${whereStatement}
            ORDER BY ${sortingColumn} ${sortingDirection}
            OFFSET ${ pageSize * pageIndex } ROWS FETCH NEXT ${pageSize} ROWS ONLY;
        `; */


    const searchQuery = `
        SELECT
            OrdersTableView.ID,
            OrdersTableView.OrderNum, 
            OrdersTableView.OrderDate,
            OrdersTableView.DeliveryDate,
            OrdersTableView.Address,
            OrdersTableView.JobNum,
            OrdersTableView.PONum,
            OrdersTableView.StairsNum,
            OrdersTableView.InputBy,
            OrdersTableView.ShipDate,
            OrdersTableView.ShipStatus,
            OrdersTableView.PublicComment,
            OrdersTableView.Model,
            OrdersTableView.Customer,
            OrdersTableView.WorkorderComments,
            OrdersTableView.CustomDelivery
        FROM OrdersTableView
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

        data.map(item => {
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
            error: 'Error happened during \'Getting workorders\' DB operation',
            message: err.message
        });
    });
};

const getOrdersByNumber = async (req, res, next) => {
    const params = req.params;
    const id = params.id;

    const searchOrdersQuery = `SELECT * 
                        FROM workorderdetails
                        WHERE workorderdetails.OrderNum = ${id}
    `;

    const searchImagesQuery = `SELECT * 
                        FROM AllPics
                        WHERE AllPics.OrderNum = ${id}
    `;

    Promise.all([
        await req.app.settings.db.query(searchOrdersQuery),
        await req.app.settings.db.query(searchImagesQuery)
    ]).then(result => {
        orders = result[0];
        images = result[1];

        let imageObj = {};
        const mimeType = 'image/png';

        images.recordset.forEach(item => {
            imageObj[item.StairNum] = item;
        });

        orders.recordset.forEach(item => {
            if (imageObj[item.StairNum]) {
                const b64 = Buffer.from(imageObj[item.StairNum].imagedata).toString('base64');
                // item.Image = imageObj[item.StairNum];
                item.Image = `data:${mimeType};base64,${b64}`;
            } else {
                item.Image = null;
            }
        });

        return res.status(200).send({
            status: 'ok',
            total: result.recordset?.length || 0,
            data: orders.recordset || []
        });
    })
    .catch(err => {
        return res.status(400).send({
            status: 'error',
            error: 'Error happened during \'Getting order by ID and images\' DB operation',
            message: err.message
        });
    });
};

const createOrder = async (req, res, next) => {
    const body = req.body;

    const customer = body.customer;
    const quote = body.quote;
    const deliveryAddress = body.deliveryAddress;
    const billingAddress = body.billingAddress;
    const orderDate = excelDateConvertor.dateInDays(new Date());
    const deliveryDate = excelDateConvertor.dateInDays(new Date(body.deliveryDate));
    const model = Number(body.model);
    const jobNum = Number(body.jobNum);
    const po = Number(body.po);
    const numOfStairs = Number(body.numOfStairs);
    const input = body.input;
    let createUncomplete;
    let createOrdersQuery;
    let createOrdersExtensionQuery;

    const takeLastOrderQuery = `
        SELECT TOP 1 Workorders.ID, Workorders.OrderNum
        FROM Workorders
        ORDER BY Workorders.ID DESC
    `;

    const lastOrderNumberData = await req.app.settings.db.query(takeLastOrderQuery);

    console.log('--DEBUG-- last order number: ', lastOrderNumberData.recordset);

    let id = lastOrderNumberData.recordset[0].ID;
    let orderNum = lastOrderNumberData.recordset[0].OrderNum;
    
    orderNum++;

    try {
        for (let i of Array(numOfStairs)) {
            id++;
        
            createUncomplete = getQueries({
                id,
                orderNum,
                deliveryDate,
            }, 'createUncomplete');
        
            createOrdersQuery = getQueries({
                id,
                customer,
                quote,
                deliveryAddress,
                billingAddress,
                orderNum,
                orderDate,
                deliveryDate,
                model,
                jobNum,
                po,
                numOfStairs,
                input,
            }, 'createOrder');
            
            createOrdersExtensionQuery = getQueries({
                id,
                orderNum,
            }, 'createOrdersExtension');
        
            await Promise.all([
                req.app.settings.db.query(createOrdersQuery),
                req.app.settings.db.query(createUncomplete),
                req.app.settings.db.query(createOrdersExtensionQuery),
            ]);
            console.log(`--DEBUG-- order with id: ${id} were created`);
        }
    } catch (err) {
        return res.status(400).send({
            status: 'error',
            message: err.message,
            error: 'Error happened during \'Creating order\' DB operation',
        });
    }

    return res.status(200).send({
        status: 'ok'
    });
}

const deleteOrder = async (req, res, next) => {
    const params = req.params;

    const orderNumber = params.orderNumber;

    try {
        deleteUncomplete = `DELETE FROM Uncomplete WHERE WONUM ${orderNumber}`;
        deleteOrderExtensionsQuery = `DELETE FROM WorkOrderExtensions WHERE WONum ${orderNumber}`;
        deleteOrdersQuery = `DELETE FROM Workorders WHERE WONUM ${orderNumber}`;
    
        await Promise.all([
            req.app.settings.db.query(deleteOrdersQuery),
            req.app.settings.db.query(deleteUncomplete),
            req.app.settings.db.query(deleteOrderExtensionsQuery),
        ]);
        console.log(`--DEBUG-- orders with order number: ${orderNumber} were deleted`);
    } catch (err) {
        return res.status(400).send({
            status: 'error',
            message: err.message,
            error: 'Error happened during \'Deleting order\' DB operation',
        });
    }

    return res.status(200).send({
        status: 'ok'
    });
}

const deleteStair = async (req, res, next) => {
    const params = req.params;

    const stairNumber = params.stairNumber;

    try {
        deleteUncomplete = `DELETE FROM Uncomplete WHERE WOID ${stairNumber}`;
        deleteOrderExtensionsQuery = `DELETE FROM WorkOrderExtensions WHERE WOID ${stairNumber}`;
        deleteOrdersQuery = `DELETE FROM Workorders WHERE ID ${stairNumber}`;
    
        await Promise.all([
            req.app.settings.db.query(deleteOrdersQuery),
            req.app.settings.db.query(deleteUncomplete),
            req.app.settings.db.query(deleteOrderExtensionsQuery),
        ]);
        console.log(`--DEBUG-- stair with order number: ${stairNumber} was deleted`);
    } catch (err) {
        return res.status(400).send({
            status: 'error',
            message: err.message,
            error: 'Error happened during \'Deleting stair\' DB operation',
        });
    }

    return res.status(200).send({
        status: 'ok'
    });
}

module.exports = {
    getOrders,
    createOrder,
    getOrdersByNumber,
    deleteOrder,
    deleteStair, 
}