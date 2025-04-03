const excelDateConvertor = require('../helpers/excel-date-convertor');
const getQueries = require('../queries');

const base64Rejex = /^(?:[A-Z0-9+\/]{4})*(?:[A-Z0-9+\/]{2}==|[A-Z0-9+\/]{3}=|[A-Z0-9+\/]{4})$/i;

const customFlairsTypeObj = {
    SACR: 1,
    DACR: 2,
    STF45: 3,
    SAF45: 4,
    STD30: 5,
    SAF30: 6
};

const customBullnoseTypeObj = {
    BULL90: 1,
    BULL180: 2,
    CBULL90: 3,
    CBULL180: 4,
    CBULLC: 5
};

const updateStairsCount = (req, numberForUpdate, orderNum) => {
    const updateOrdersQuery = `UPDATE Workorders SET StairsNum=${numberForUpdate} WHERE OrderNum=${orderNum}`;
    
    return req.app.settings.db.query(updateOrdersQuery);
}

const firstDayOfNextMonth = (excelDate) => { 
    const baseDate = new Date(1900, 0, 1); 
    const msInADay = 86400000; // Milliseconds in one day 
    
    const daysSinceBaseDate = excelDate - 2; // Excel considers 1900 as a leap year, so subtract 2 
    const date = new Date(baseDate.getTime() + daysSinceBaseDate * msInADay); 
    
    date.setDate(1); 
    date.setMonth(date.getMonth() + 1); 
    
    const newExcelDate = (date - baseDate) / msInADay + 2; // Add 2 to account for Excel's leap year bug 
    
    const timePart = excelDate - Math.floor(excelDate); 
    
    return Math.floor(newExcelDate) + timePart; 
}

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
            OrdersTableView.CustomerID,
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

        let mimeType;
        let ext;

        orders.recordset.forEach(order => {
            let orderImages = images.recordset.filter((image) => {
                return image.ID === order.ID;
            });
            
            if (orderImages?.length) {
                let b64;
                let isBase64Valid;

                if (!order.Images) order.Images = [];

                orderImages.forEach((image) => {
                    ext = 'png';

                    if (image.OriginalFilename) {
                        const originalExt = image.OriginalFilename.split('.');
    
                        ext = originalExt.length > 1 ? originalExt[1] : ext;
                    }
    
                    mimeType = `image/${ext}`;
                    b64 = Buffer.from(image.imagedata).toString();
                    isBase64Valid = base64Rejex.test(b64);
                    
                    let resultImage = null;

                    if (isBase64Valid) {
                        resultImage = `data:${mimeType};base64,${b64}`;
                    } else {
                        b64 = Buffer.from(image.imagedata).toString('base64');
                        isBase64Valid = base64Rejex.test(b64);
    
                        if (isBase64Valid) {
                            resultImage = `data:${mimeType};base64,${b64}`;
                        }
                    }

                    if (resultImage) order.Images.push({
                        id: image.PicID,
                        type: image.PicType,
                        text: image.PicText,
                        img: resultImage
                    });
                });
            } else {
                order.Images = [];
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

const getSalesOrdersByNumber = async (req, res, next) => {
    const params = req.params;
    const id = params.orderNumber;

    const searchOrdersQuery = `SELECT * 
                        FROM PricingView
                        WHERE PricingView.OrderNum = ${id}
    `;

    const salesOrders = await req.app.settings.db.query(searchOrdersQuery);

    return res.status(200).send({
        status: 'ok',
        total: salesOrders.recordset?.length || 0,
        data: salesOrders.recordset || []
    });
};

const getDefaultImages = async (req, res, next) => {
    const getDefaultImagesQuery = `
        SELECT ID, ImageText, imagedata
        FROM stairimages
        WHERE workorderID IS NULL
    `;

    const defaultImages = await req.app.settings.db.query(getDefaultImagesQuery);
    let defaultImagesData = defaultImages.recordset;

    defaultImagesData = defaultImagesData.map(img => {
        let b64;
        let isBase64Valid;
        let mimeType;

        let ext = 'png';

        mimeType = `image/${ext}`;
        b64 = Buffer.from(img.imagedata).toString();
        isBase64Valid = base64Rejex.test(b64);
        
        let resultImage = null;

        if (isBase64Valid) {
            resultImage = `data:${mimeType};base64,${b64}`;
        } else {
            b64 = Buffer.from(img.imagedata).toString('base64');
            isBase64Valid = base64Rejex.test(b64);

            if (isBase64Valid) {
                resultImage = `data:${mimeType};base64,${b64}`;
            }
        }

        img.Image = resultImage;

        return img;
    });

    return res.status(200).send({
        total: defaultImagesData.length,
        data: defaultImagesData,
    });
}

const createOrder = async (req, res, next) => {
    const body = req.body;

    let orderNum = body.orderNum;
    let id = body.id;
    const newStair = !!orderNum;

    let customer;
    let quote;
    let deliveryAddress;
    let billingAddress;
    let orderDate;
    let deliveryDate;
    let model;
    let jobNum;
    let po;
    let numOfStairs;
    let input;
    
    let numberOfOrders;

    if (newStair) {
        const order = await req.app.settings.db.query(`SELECT InputBy, StairsNum, PONum, JobNum, Model, OrderDate, Customer, Address, BillingAddress, DeliveryDate, Quote FROM Workorders WHERE ID=${id}`);

        customer = order?.recordset[0].Customer;
        quote = order?.recordset[0].Quote;
        deliveryDate = order?.recordset[0].DeliveryDate;
        billingAddress = order?.recordset[0].BillingAddress;
        orderDate = order?.recordset[0].OrderDate;
        deliveryAddress = order?.recordset[0].Address;
        model = order?.recordset[0].Model;
        jobNum = order?.recordset[0].JobNum || "''";
        po = order?.recordset[0].PONum || "''";
        numOfStairs = order?.recordset[0].StairsNum;
        input = order?.recordset[0].InputBy;

        numberOfOrders = 1;

        console.log('--DEBUG-- order: ', order.recordset[0]);
    } else {
        customer = body.customer;
        quote = body.quote;
        deliveryAddress = body.deliveryAddress;
        billingAddress = body.billingAddress;
        orderDate = excelDateConvertor.dateInDays(new Date());
        deliveryDate = excelDateConvertor.dateInDays(new Date(body.deliveryDate));
        model = Number(body.model);
        jobNum = Number(body.jobNum);
        po = Number(body.po);
        numOfStairs = Number(body.numOfStairs);
        input = body.input;

        numberOfOrders = numOfStairs;
    }

    let createUncomplete;
    let createOrdersQuery;
    let createOrdersExtensionQuery;

    const takeLastIdQuery = `
        SELECT TOP 1 Workorders.ID
        FROM Workorders
        ORDER BY Workorders.ID DESC
    `;

    const lastOrderID = await req.app.settings.db.query(takeLastIdQuery);

    id = lastOrderID.recordset[0].ID;
    
    console.log('--DEBUG-- new id: ', id);

    if (!newStair) {
        const takeLastOrderNumQuery = `
            SELECT TOP 1 Workorders.OrderNum
            FROM Workorders
            ORDER BY Workorders.OrderNum DESC
        `;

        const lastOrderNum = await req.app.settings.db.query(takeLastOrderNumQuery);
        
        orderNum = lastOrderNum.recordset[0].OrderNum;
    
        orderNum++;
    }

    try {
        for (let i of Array(numberOfOrders)) {
            id++;

            createUncomplete = getQueries({
                id,
                orderNum,
                deliveryDate,
                location: ''
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
            console.log('--DEBUG-- createOrdersQuery: ', createOrdersQuery);

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

        if (newStair) {
            await updateStairsCount(req, numOfStairs + 1, orderNum);
        } else {
            const updateModelQuery = `
                UPDATE
                    stairs.dbo.Models
                SET
                    Workorder='${orderNum}',
                    Customer='${customer}'
                WHERE
                    ID=${model}
            `;

            console.log('--DEBUG-- update Model Query: ', updateModelQuery);

            await req.app.settings.db.query(updateModelQuery);
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
    let deleteComplete;
    let deleteUncomplete;
    let deleteOrderExtensionsQuery;
    let deleteOrdersQuery;

    console.log(`--DEBUG-- order with number: ${orderNumber} will be deleted`);

    try {
        deleteComplete = `DELETE FROM stairs_server.dbo.Complete WHERE WONUM=${orderNumber}`;
        deleteUncomplete = `DELETE FROM stairs_server.dbo.Uncomplete WHERE WONUM=${orderNumber}`;
        deleteOrderExtensionsQuery = `DELETE FROM WorkOrderExtensions WHERE WONum=${orderNumber}`;
        deleteOrdersQuery = `DELETE FROM Workorders WHERE OrderNum=${orderNumber}`;
    
        await Promise.all([
            req.app.settings.db.query(deleteComplete),
            req.app.settings.db.query(deleteUncomplete),
            req.app.settings.db.query(deleteOrdersQuery),
            req.app.settings.db.query(deleteOrderExtensionsQuery),
        ]);
        console.log(`--DEBUG-- orders with number: ${orderNumber} were deleted`);
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
    const q = req.query;
    const orderNum = q.orderNumber;
    const stairsCount = q.stairsCount
    let deleteUncomplete;
    let deleteOrderExtensionsQuery;
    let deleteOrdersQuery;

    const stairNumber = params.stairNumber;
    console.log(`--DEBUG-- stair with number: ${stairNumber} of ${orderNum} order will be deleted, stairs count ${stairsCount}`);

    try {
        deleteUncomplete = `DELETE FROM stairs_server.dbo.Uncomplete WHERE WOID=${stairNumber}`;
        deleteOrderExtensionsQuery = `DELETE FROM WorkOrderExtensions WHERE WOID=${stairNumber}`;
        deleteOrdersQuery = `DELETE FROM Workorders WHERE ID=${stairNumber}`;
    
        await Promise.all([
            req.app.settings.db.query(deleteOrdersQuery),
            req.app.settings.db.query(deleteUncomplete),
            req.app.settings.db.query(deleteOrderExtensionsQuery),
        ]);

        if (Number(stairsCount) > 1) {
            const numberForUpdate = Number(stairsCount) - 1;

            await updateStairsCount(req, numberForUpdate, orderNum);
        }
        console.log(`--DEBUG-- stair with number: ${stairNumber} was deleted`);
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

const updateStair = async (req, res, next) => {
    const params = req.params;
    const body = req.body;
    const id = params.id;
    const type = body.sectionType; //Winder (CustomWindersType) / Landing (Landing_Wrap_OSM)
    let updateOrdersExtensionQuery;
    let updateOrdersQuery;
    let queryName;

    //common
    let location;
    let numberOfRises;
    let numberOfTreads;
    let stairStyle;
    let riserType;
    let connectedToOthers;
    let totalHeight;
    let numberStaircasesInHeight;
    let numberWindersAndLanding;
    let connectedTo;
    let workorderComments;
    let cutlistComments;
    let billingComments;
    let invoiceComments;

    let blurbLeftFlair;
    let blurbRightFlair;
    let blurbLeftBullnose;
    let blurbRightBullnose;

    let customFlairsTypeRight;
    let customBullnoseTypeRight;
    let customFlairsType;
    let customBullnoseType;

    //winder
    let winderRise;
    let winderPickup;
    let winderOn1;
    let winderOn3;
    let winderWrap;
    let winderCutCorner;
    let winderSeat;
    let winderSeatLength;
    let customWindersType;
    let customWindersL;
    let customWindersR;
    let blurbWinder;

    //stair
    let lngth;
    let height;
    let width;
    let osm;
    let run; // not editable
    let rise; // not editable
    let method;
    let notch;
    let headroomMatters;
    let offTheTop;
    let noNosing;
    let thirdAndFurred;
    let materials;
    let stringerStyle1;
    let stringerStyle2;
    let oneInchPly;
    let halfInchPly;
    let meas2X6;
    let meas2x10;
    let meas2x12;
    let divisor;
    let custGarage;
    let custDeck;
    let custStyle1Adj;
    let custStyle2Adj;
    let sill;
    let opening;
    let joist;
    let headroomTotal;
    let third;
    
    //landing
    let landingPickup;
    let landingWrapPlusOneNosing;
    let landingSeat;
    let landingOsmOnPickup;
    let landingOsmOnWrap;
    let landingSitsOnFloor;
    let customLandingL;
    let squareLanding;
    let blurbLanding;

    if (type === 'Stair') {
        //Workorders Table DB
        location = body.location;
        numberOfRises = body.numberOfRises;
        numberOfTreads = body.numberOfTreads;
        stairStyle = Number(body.stairStyle);
        stairType = Number(body.stairType);
        riserType = Number(body.riserType);
        lngth = body.lngth;
        height = body.height;
        width = body.width;
        method = body.method;
        notch = body.notch ? 1 : 0;
        headroomMatters = body.headroomMatters ? 1 : 0;;
        noNosing = body.noNosing ? 1 : 0;
        thirdAndFurred = body.thirdAndFurred ? 1 : 0;
        materials = body.materials;
        stringerStyle1 = body.stringerStyle1;
        stringerStyle2 = body.stringerStyle2;
        divisor = body.divisor;
        osm = body.osm;
        oneInchPly = body.oneInchPly;
        halfInchPly = body.halfInchPly;
        meas2X6 = body.meas2X6;
        meas2x10 = body.meas2X10;
        meas2x12 = body.meas2X12;

        joist = body.joist || 0;
        sill = body.sill || 0;
        opening = body.opening || 0;
        third = body.third ? 1 : 0;

        blurbLeftFlair = body.blurb_left_flair;
        blurbRightFlair = body.blurb_right_flair;
        blurbLeftBullnose = body.blurb_left_bullnose;
        blurbRightBullnose = body.blurb_right_bullnose;

        customFlairsTypeRight = blurbRightFlair ? customFlairsTypeObj[blurbRightFlair] : '';
        customFlairsType = blurbLeftFlair ? customFlairsTypeObj[blurbLeftFlair] : '';

        customBullnoseTypeRight = blurbRightBullnose ? customBullnoseTypeObj[blurbRightBullnose] : '';
        customBullnoseType = blurbLeftBullnose ? customBullnoseTypeObj[blurbLeftBullnose] : '';

        console.log('--DEBUG-- flairs&bullnoses: ', {
            customFlairsTypeRight,
            customFlairsType,
            customBullnoseTypeRight,
            customBullnoseType
        });

        //WorkOrderExtensions
        offTheTop = body.offTheTop ? 1 : 0;

        queryName = 'updateStairOrder';

        updateOrdersExtensionQuery = `
            UPDATE
                stairs.dbo.WorkOrderExtensions
            SET
                OffTheTop=${offTheTop}
            WHERE
                WOID=${id}
        `;
    }

    if (type === 'Winder') {
        //Workorders Table DB
        location = body.location || body.winderLocation;
        numberOfRises = body.numberOfRises;
        stairStyle = Number(body.stairStyle) // Style
        riserType = Number(body.riserType); // RiserType
        osm = body.osm;

        winderRise = body.winderRise;
        winderWrap = body.winderWrap;
        winderPickup = body.winderPickup;
        winderOn1 = body.winderOn1;
        winderOn3 = body.winderOn3;
        winderSeat = body.winderSeat ? 1 : 0;
        winderSeatLength = body.winderSeatLength;
        winderCutCorner = body.winderCutCorner;

        let winderTypeSide = body.winderType[body.winderType.length - 1];

        if (winderTypeSide === 'L') {
            customWindersL = 1;
            customWindersR = 0;
        
        }
        if (winderTypeSide === 'R') {
            customWindersL = 0;
            customWindersR = 1;
        }
        
        if (body.winderType === 'WIND_L') customWindersType = 1;
        if (body.winderType === 'WIND_R') customWindersType = 6;

        if (body.winderType === 'WINDC_L') customWindersType = 2;
        if (body.winderType === 'WINDC_R') customWindersType = 7;

        if (body.winderType === 'WINDF_L') customWindersType = 3;
        if (body.winderType === 'WINDF_R') customWindersType = 8;

        if (body.winderType === 'WIND45_L') customWindersType = 4;
        if (body.winderType === 'WIND45_R') customWindersType = 9;

        if (body.winderType === 'WIND45C_L') customWindersType = 5;
        if (body.winderType === 'WIND45C_R') customWindersType = 10;
        
        let side = body.winderType[body.winderType.length - 1];
        let winderTread = side === 'L' ? '3 tr;' : '2 tr;';

        blurbWinder = `${body.winderType}-${winderTread}${side}: ${Number(winderPickup)} PU. ${Number(winderWrap)} W; ${Number(winderOn1)} on 1. ${Number(winderOn3)} on 3; ${Number(winderRise)} rise;`;

        if (winderSeat) blurbWinder += `${winderSeatLength}" seat;`;

        queryName = 'updateWinderOrder';
    }

    if (type === 'Landing') {
        //Workorders Table DB
        location = body.location;
        osm = body.osm;

        landingType = body.landingType;
        landingPickup = Number(body.landingPickup);
        landingOsmOnWrap = Number(body.landingOsmOnWrap);
        landingWrapPlusOneNosing = Number(body.landingWrapPlusOneNosing);
        landingSeat = Number(body.landingSeat);
        landingOsmOnPickup = Number(body.landingOsmOnPickup);
        landingSitsOnFloor = body.landingSitsOnFloor ? 1 : 0;
        stringerStyle1 = -1;
        let side = '';

        if (landingType === 'LANDINGL') {
            customLandingL = 1;
            squareLanding = 0;
        }

        if (landingType === 'LANDINGR') {
            customLandingL = 0;
            squareLanding = 0;
        }

        if (landingType === 'SQR_LANDINGL') {
            customLandingL = 1;
            squareLanding = 1;
        }

        if (landingType === 'SQR_LANDINGR') {
            customLandingL = 0;
            squareLanding = 1;
        }

        if (landingType === 'LANDINGSTR') {
            customLandingL = 0;
            squareLanding = 0;
            stringerStyle1 = 1212;

            side = 'STRAIGHT';
        }

        if (landingType !== 'LANDINGSTR') {
            side = customLandingL === 1 ? 'LEFT' : 'RIGHT';
        }

        blurbLanding = `${squareLanding === 1 ? '(SQUARE LANDING) ' : ''}${landingPickup?.toFixed(4)}" PU, ${landingSeat?.toFixed(4)}" seat, ${landingOsmOnPickup?.toFixed(4)}" PU OSM, ${landingWrapPlusOneNosing?.toFixed(4)}" Wrap, ${landingOsmOnWrap?.toFixed(4)}" Wrap OSM - ${side} `

        queryName = 'updateLandingOrder';
    }

    //Workorders, 'connection section'
    connectedToOthers = body.connectedToOthers ? 1 : 0; // Connected
    totalHeight = body.totalHeight;
    numberStaircasesInHeight = body.countStairsInHeight;
    numberWindersAndLanding = body.countWindersAndLandings ? 1 : 0;
    connectedTo = body.connectedTo;

    //Workorders, 'comments section'
    workorderComments = body.workorderComments;
    cutlistComments = body.cutlistComments;
    billingComments = body.billingComments;
    invoiceComments = body.invoiceComments;

    switch (queryName) {
        case 'updateStairOrder': {
            updateOrdersQuery = getQueries({
                id,
                location,
                numberOfRises,
                numberOfTreads,
                stairStyle,
                stairType,
                riserType,
                lngth,
                height,
                width,
                method,
                notch,
                headroomMatters,
                noNosing,
                thirdAndFurred,
                materials,
                stringerStyle1,
                stringerStyle2,
                divisor,
                osm,
                oneInchPly,
                halfInchPly,
                meas2X6,
                meas2x10,
                meas2x12,

                joist,
                sill,
                opening,
                third,

                blurbLeftFlair,
                blurbRightFlair,
                blurbLeftBullnose,
                blurbRightBullnose,

                customFlairsTypeRight,
                customFlairsType,

                customBullnoseTypeRight,
                customBullnoseType,

                connectedToOthers,
                totalHeight,
                numStrcasesInHeight: numberStaircasesInHeight,
                numberWindersAndLanding: numberWindersAndLanding,
                connectedTo,

                cutlistComments,
                workorderComments,
                billingComments,
                invoiceComments
            }, queryName);

            break;
        }

        case 'updateWinderOrder': {
            updateOrdersQuery = getQueries({
                id,
                location,
                numberOfRises,
                stairStyle,
                riserType,
                winderRise,
                winderWrap,
                winderPickup,
                winderOn1,
                winderOn3,
                winderSeat,
                winderSeatLength,
                winderCutCorner,
                customWindersType,
                customWindersL,
                customWindersR,
                blurbWinder,

                connectedToOthers,
                totalHeight,
                numStrcasesInHeight: numberStaircasesInHeight,
                numberWindersAndLanding: numberWindersAndLanding,
                connectedTo,
    
                cutlistComments,
                workorderComments,
                billingComments,
                invoiceComments
            }, queryName);

            break;
        }

        case 'updateLandingOrder': {
            updateOrdersQuery = getQueries({
                id,
                location,
                landingPickup,
                landingWrapPlusOneNosing,
                landingSeat,
                landingOsmOnPickup,
                landingOsmOnWrap,
                landingSitsOnFloor,
                customLandingL,
                squareLanding,
                blurbLanding,
                stringerStyle1,
    
                connectedToOthers,
                totalHeight,
                numStrcasesInHeight: numberStaircasesInHeight,
                numberWindersAndLanding: numberWindersAndLanding,
                connectedTo,
    
                cutlistComments,
                workorderComments,
                billingComments,
                invoiceComments
            }, queryName);

            break;
        }
    }    

    console.log('--DEBUG-- workorders update', updateOrdersQuery);

    try {
        if (updateOrdersExtensionQuery) {
            await Promise.all([
                req.app.settings.db.query(updateOrdersQuery),
                req.app.settings.db.query(updateOrdersExtensionQuery),
            ]);
        } else {
            await req.app.settings.db.query(updateOrdersQuery);
        }
    } catch (err) {
        return res.status(400).send({
            status: 'error',
            message: err.message,
            error: 'Error happened during \'Updating stair\' DB operation',
        });
    }

    res.status(200).send({
        status: 'success'
    });
}

const updateStatus = async (req, res, next) => {
    const params = req.params;
    const body = req.body;
    const orderNumber = params.orderNumber;
    const status = body.status;
    let updateQuery = '';
    let deliveryDate = '';
    
    if (['Delivered', 'Picked Up'].includes(status)) {
        const takeLastCompletedQuery = `
            SELECT TOP 1 stairs_server.dbo.Complete.ID, stairs_server.dbo.Complete.Delivery
            FROM stairs_server.dbo.Complete
            WHERE WONUM=${orderNumber}
            ORDER BY stairs_server.dbo.Complete.ID DESC
        `;

        const lastOrderNumberData = await req.app.settings.db.query(takeLastCompletedQuery);
        console.log('--DEBUG-- lastOrderNumberData: ', lastOrderNumberData);

        if (lastOrderNumberData.recordset && lastOrderNumberData.recordset.length) {
            deliveryDate = lastOrderNumberData.recordset[0].Delivery;
        }
    }

    switch (status) {
        case 'Loaded': {
            updateQuery = `UPDATE 
                            stairs_server.dbo.Complete
                        SET ShipFlag=1,
                            ShipDate=0
                        WHERE WONUM=${orderNumber}`
            
            break;
        }

        case 'Unloaded': {
            updateQuery = `UPDATE 
                            stairs_server.dbo.Complete
                        SET ShipFlag=0,
                            ShipDate=0
                        WHERE WONUM=${orderNumber}`

            break;
        }

        case 'Delivered': {
            let shipDate = firstDayOfNextMonth(deliveryDate);

            updateQuery = `UPDATE 
                            stairs_server.dbo.Complete
                        SET ShipFlag=2,
                            ShipDate=${shipDate}
                        WHERE WONUM=${orderNumber}`

            break;
        }

        case 'Picked Up': {
            let shipDate = firstDayOfNextMonth(deliveryDate);

            updateQuery = `UPDATE 
                            stairs_server.dbo.Complete
                        SET ShipFlag=4,
                            ShipDate=${shipDate}
                        WHERE WONUM=${orderNumber}`

            break;
        }
    }

    try {
        await req.app.settings.db.query(updateQuery);
    } catch (err) {
        return res.status(400).send({
            status: 'error',
            message: err.message,
            error: 'Error happened during \'Updating order ship status\' DB operation',
        });
    }

    console.log('--DEBUG-- update order ship status query: ', updateQuery);

    return res.status(200).send({
        status: 'ok'
    });
}

const uploadImage = async (req, res, next) => {
    const body = req.body;
    const params = req.params;

    const imagedata = body.imagedata.split(',')[1];
    const imagetext = body.imagetext.split('.')[0];
    const originalfilename = body.imagetext;
    const workorderID = params.id;
    const orderNum = body.orderNum;
    const description = body.description;

    if (!imagedata) {
        return res.status(400).send({
            status: 'Image doesn\'t exists'
        });
    }

    const createImageQuery = `
        INSERT INTO stairs.dbo.stairimages (
            ImageText,
            Originalfilename,
            workorderID,
            imagedata,
            OrderNum,
            Shipping,
            ShowLarge,
            Description
        ) VALUES (
            '${imagetext}',
            '${originalfilename}',
            '${workorderID}',
            CONVERT(VARBINARY(MAX), '${imagedata}'),
            '${orderNum}',
            0,
            0,
            '${description}'
        )`;

        console.log('--DEBUG-- createImageQuery: ', createImageQuery);

        try {
            await req.app.settings.db.query(createImageQuery)
        } catch (err) {
            return res.status(400).send({
                status: 'error',
                message: err.message,
                error: 'Error happened during \'Creating image\' DB operation',
            });
        }

        return res.status(200).send({
            status: 'ok'
        });
}

const removeImage = async (req, res, next) => {
    const params = req.params;
    const orderID = params.orderID;
    const id = params.id;
    const removeImageQuery = `DELETE FROM stairs.dbo.stairimages WHERE workorderID=${orderID} AND ID=${id}`;

    console.log('--DEBUG-- removeImage: ', removeImageQuery);

    try {
        await req.app.settings.db.query(removeImageQuery);
    } catch (err) {
        return res.status(400).send({
            status: 'error',
            message: err.message,
            error: 'Error happened during \'Removing image\' DB operation',
        });
    }

    return res.status(200).send({
        status: 'ok'
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
    let complete


    console.log('--DEBUG-- duplicate: ', orderNum);

    const getWorkordersQuery = `
        SELECT *
        FROM Workorders
        WHERE OrderNum=${orderNum}
    `;

    const getWorkorderExtensionsQuery = `
        SELECT *
        FROM WorkOrderExtensions
        WHERE WONum=${orderNum}
    `;

    const getCompleteQuery = `
        SELECT *
        FROM stairs_server.dbo.Complete
        WHERE WONUM=${orderNum}
    `;

    const getUncompleteQuery = `
        SELECT *
        FROM stairs_server.dbo.Uncomplete
        WHERE WONUM=${orderNum}
    `;
    
    let results = await Promise.all([
        req.app.settings.db.query(getWorkordersQuery),
        req.app.settings.db.query(getWorkorderExtensionsQuery),
        req.app.settings.db.query(getCompleteQuery),
        req.app.settings.db.query(getUncompleteQuery),
    ]);

    workorders = results[0] && results[0].recordset;
    workordersExtensions = results[1] && results[1].recordset;
    complete = results[2] && results[2].recordset;
    uncomplete = results[3] && results[3].recordset;

    if (action === 'duplicate') {
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

        console.log('--DEBUG-- highest order num: ', newOrderNum);
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
    
                    const completeItem = complete.find(c => c.WOID === workorder.ID);
                    
                    if (completeItem) {
                        completeItem['NewID'] = id;
                        completeItem['NewOrderNum'] = newOrderNum;
    
                        let completeOrderCreateQuery = getQueries(completeItem, 'createFullComplete');
                        console.log('--DEBUG-- completed query is ready! ', completeOrderCreateQuery);

                        await req.app.settings.db.query(completeOrderCreateQuery);
                        console.log(`--DEBUG-- complete order ${newOrderNum} with id ${id} was created;`);
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

        console.log('--DEBUG-- highest quote num: ', newOrderNum);
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
            
                        console.log('--DEBUG-- uncompleted query is ready! ', uncompleteOrderCreateQuery);

                        await req.app.settings.db.query(uncompleteOrderCreateQuery);
                        console.log(`--DEBUG-- uncomplete quote ${newOrderNum} with id ${id} was created;`);
                    } else {
                        let createUncompleteQuery = getQueries({
                            id,
                            orderNum,
                            deliveryDate,
                            location: ''
                        }, 'createUncomplete');

                        console.log('--DEBUG-- new uncompleted query is ready! ', createUncompleteQuery);

                        await req.app.settings.db.query(createUncompleteQuery);
                        
                        console.log(`--DEBUG-- new uncomplete quote ${newOrderNum} with id ${id} was created;`);
                    }
                }

                // DELETING ORDER THAT WAS CONVERTED

                let deleteComplete;
                let deleteUncomplete;
                let deleteOrderExtensionsQuery;
                let deleteOrdersQuery;

                console.log(`--DEBUG-- order with number: ${orderNum} will be deleted`);

                try {
                    deleteComplete = `DELETE FROM stairs_server.dbo.Complete WHERE WONUM=${orderNum}`;
                    deleteUncomplete = `DELETE FROM stairs_server.dbo.Uncomplete WHERE WONUM=${orderNum}`;
                    deleteOrderExtensionsQuery = `DELETE FROM WorkOrderExtensions WHERE WONum=${orderNum}`;
                    deleteOrdersQuery = `DELETE FROM Workorders WHERE OrderNum=${orderNum}`;
                
                    await Promise.all([
                        req.app.settings.db.query(deleteComplete),
                        req.app.settings.db.query(deleteUncomplete),
                        req.app.settings.db.query(deleteOrdersQuery),
                        req.app.settings.db.query(deleteOrderExtensionsQuery),
                    ]);
                    console.log(`--DEBUG-- orders with number: ${orderNum} were deleted`);
                } catch (err) {
                    return res.status(400).send({
                        status: 'error',
                        message: err.message,
                        error: 'Error happened during \'Deleting order\' DB operation',
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

    return res.status(400).send({
        status: 'error',
        message: err.message,
        error: 'Choose correct action!',
    });
}


module.exports = {
    getOrders,
    createOrder,
    getOrdersByNumber,
    deleteOrder,
    deleteStair,
    updateStair,
    updateStatus,
    uploadImage,
    removeImage,
    getDefaultImages,
    getSalesOrdersByNumber,
    duplicate,
}