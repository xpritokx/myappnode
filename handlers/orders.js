let Orders = [{
        ID: 37053,
        OrderNum: 27230,
        Customer: 372,
        BillindAddress: 'KINCORA',
        Address: 'Bilding 8 Unit 214',
        Model: 2155,
        StairsNum: 4,
        OrderDate: 40168.285156,
        DeliveryDate: 'Base',
        Height: '99.375',
        Width: 41.25,
        HeadroomMatters: 0
    },
    {
        ID: 37080,
        OrderNum: 27238,
        Customer: 146,
        BillindAddress: 'Calgary',
        Address: '208 Elgin Meadows Garden',
        Model: 184,
        StairsNum: 5,
        OrderDate: 40168.285156,
        DeliveryDate: 'Low',
        Height: '83.1875',
        Width: 38.25,
        HeadroomMatters: 0
    },
    {
        ID: 37129,
        OrderNum: 27250,
        Customer: 405,
        BillindAddress: 'Calgary',
        Address: '1275 New Bringhton Drive',
        Model: 2478,
        StairsNum: 6,
        OrderDate: 40168.285156,
        DeliveryDate: 'Mid',
        Height: '22',
        Width: 40.5,
        HeadroomMatters: 0
    },
    {
        ID: 37053,
        OrderNum: 27230,
        Customer: 372,
        BillindAddress: 'KINCORA',
        Address: 'Bilding 8 Unit 214',
        Model: 2155,
        StairsNum: 4,
        OrderDate: 40168.285156,
        DeliveryDate: 'Base',
        Height: '99.375',
        Width: 41.25,
        HeadroomMatters: 0
    },
    {
        ID: 37080,
        OrderNum: 27238,
        Customer: 146,
        BillindAddress: 'Calgary',
        Address: '208 Elgin Meadows Garden',
        Model: 184,
        StairsNum: 5,
        OrderDate: 40168.285156,
        DeliveryDate: 'Low',
        Height: '83.1875',
        Width: 38.25,
        HeadroomMatters: 0
    },
    {
        ID: 37129,
        OrderNum: 27250,
        Customer: 405,
        BillindAddress: 'Calgary',
        Address: '1275 New Bringhton Drive',
        Model: 2478,
        StairsNum: 6,
        OrderDate: 40168.285156,
        DeliveryDate: 'Mid',
        Height: '22',
        Width: 40.5,
        HeadroomMatters: 0
    },
    {
        ID: 37053,
        OrderNum: 27230,
        Customer: 372,
        BillindAddress: 'KINCORA',
        Address: 'Bilding 8 Unit 214',
        Model: 2155,
        StairsNum: 4,
        OrderDate: 40168.285156,
        DeliveryDate: 'Base',
        Height: '99.375',
        Width: 41.25,
        HeadroomMatters: 0
    },
    {
        ID: 37080,
        OrderNum: 27238,
        Customer: 146,
        BillindAddress: 'Calgary',
        Address: '208 Elgin Meadows Garden',
        Model: 184,
        StairsNum: 5,
        OrderDate: 40168.285156,
        DeliveryDate: 'Low',
        Height: '83.1875',
        Width: 38.25,
        HeadroomMatters: 0
    },
    {
        ID: 37129,
        OrderNum: 27250,
        Customer: 405,
        BillindAddress: 'Calgary',
        Address: '1275 New Bringhton Drive',
        Model: 2478,
        StairsNum: 6,
        OrderDate: 40168.285156,
        DeliveryDate: 'Mid',
        Height: '22',
        Width: 40.5,
        HeadroomMatters: 0
    },
    {
        ID: 37053,
        OrderNum: 27230,
        Customer: 372,
        BillindAddress: 'KINCORA',
        Address: 'Bilding 8 Unit 214',
        Model: 2155,
        StairsNum: 4,
        OrderDate: 40168.285156,
        DeliveryDate: 'Base',
        Height: '99.375',
        Width: 41.25,
        HeadroomMatters: 0
    },
    {
        ID: 37080,
        OrderNum: 27238,
        Customer: 146,
        BillindAddress: 'Calgary',
        Address: '208 Elgin Meadows Garden',
        Model: 184,
        StairsNum: 5,
        OrderDate: 40168.285156,
        DeliveryDate: 'Low',
        Height: '83.1875',
        Width: 38.25,
        HeadroomMatters: 0
    },
    {
        ID: 37129,
        OrderNum: 27250,
        Customer: 405,
        BillindAddress: 'Calgary',
        Address: '1275 New Bringhton Drive',
        Model: 2478,
        StairsNum: 6,
        OrderDate: 40168.285156,
        DeliveryDate: 'Mid',
        Height: '22',
        Width: 40.5,
        HeadroomMatters: 0
    }
];

let getOrders = async (req, res, next) => {
    const pageSize = req.query.pageSize || 25;
    const pageIndex = req.query.pageIndex || 0;

    Promise.all([
        req.app.settings.db.query(`
            SELECT COUNT(*) AS 'total' FROM Workorders;
        `),
        req.app.settings.db.query(`
            SELECT TOP 200 * FROM Workorders;
        `)
    ]).then(result => {
        const total = result[0].recordset[0].total;
        const data = result[1].recordset;

        return res.status(200).send({
            total: total,
            data: data,
        });
    }).catch(err => {
        return res.status(400).send({
            error: 'Error happened during "Getting workorders" DB operation',
            message: err.message
        });
    });
};

module.exports = {
    getOrders,
}