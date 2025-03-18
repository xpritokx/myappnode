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

    const takeLastOrderQuery = `
        SELECT TOP 1 Workorders.ID, Workorders.OrderNum
        FROM Workorders
        ORDER BY Workorders.ID DESC
    `;

    const lastOrderNumberData = await req.app.settings.db.query(takeLastOrderQuery);

    console.log('--DEBUG-- lastOrderNumberData.recordset[0].ID ', lastOrderNumberData.recordset[0].ID);

    id = lastOrderNumberData.recordset[0].ID;
    
    if (!newStair) {
        orderNum = lastOrderNumberData.recordset[0].OrderNum;
    
        orderNum++;
    }

    try {
        for (let i of Array(numberOfOrders)) {
            id++;
        
            createUncomplete = getQueries({
                id,
                orderNum,
                deliveryDate,
            }, 'createComplete');

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
    console.log(`--DEBUG-- order with number: ${orderNumber} will be deleted`);

    try {
        deleteUncomplete = `DELETE FROM stairs_server.dbo.Uncomplete WHERE WONUM=${orderNumber}`;
        deleteOrderExtensionsQuery = `DELETE FROM WorkOrderExtensions WHERE WONum=${orderNumber}`;
        deleteOrdersQuery = `DELETE FROM Workorders WHERE WONUM=${orderNumber}`;
    
        await Promise.all([
            await req.app.settings.db.query(deleteUncomplete),
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
    let meas2X10;
    let meas2X12;
    let divisor;
    
    //landing
    let landingPickup;
    let landingWrapPlusOneNosing;
    let landingSeat;
    let landingOsmOnPickup;
    let landingOsmOnWrap;
    let landingSitsOnFloor;

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
        meas2X10 = body.meas2X10;
        meas2X12 = body.meas2X12;

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

        queryName = 'updateWinderOrder';
    }

    if (type === 'Landing') {
        //Workorders Table DB
        location = body.location;
        osm = body.osm;

        landingType = body.landingType;
        landingPickup = body.landingPickup;
        landingWrapPlusOneNosing = body.landingWrapPlusOneNosing;
        landingSeat = body.landingSeat;
        landingOsmOnPickup = body.landingOsmOnPickup;
        landingSitsOnFloor = body.landingSitsOnFloor ? 1 : 0;

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
                meas2X10,
                meas2X12,

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
}