const getQuery = (args, queryName) => {
    console.log('--DEBUG-- updateStair ARGS!: ',  args);

    const queries = {
        'createComplete': `
        INSERT INTO stairs_server.dbo.Complete (
            WOID,
            WONUM,
            Delivery,
            RComplete,
            reID,
            CComplete,
            ceID,
            AComplete,
            aeID,
            StairType,
            CutBase,
            CutBlock,
            CutRises,
            CutStringers,
            CutTread,
            RDate,
            CDate,
            ADate,
            CutBaseDate,
            CutBlockDate,
            CutRisesDate,
            CutStringersDate,
            CutTreadDate,
            Location,
            ShipFlag,
            ShipDate
        ) VALUES (
            ${args.id},
            ${args.orderNum},
            ${args.deliveryDate},
            0,
            0,
            0,
            0,
            0,
            0,
            1,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            '',
            0,
            0
        )`,

        'createOrdersExtension': `
        INSERT INTO stairs.dbo.WorkOrderExtensions (
            WONum,
            WOID,
            PublicComment,
            OffTheTop,
            WinderSeatLength,
            RunAccuracy,
            MeasureTrips,
            InstallTrips,
            DistanceToSite,
            InvoiceNo,
            SalesPerson,
            StringerOnly,
            NumStringers,
            TempStairsInc,
            TempStairsCharge,
            CustomDelivery,
            DeliveryComments
        ) VALUES (
            ${args.orderNum},
            ${args.id},
            '',
            0,
            0,
            4,
            0,
            0,
            0,
            '',
            '',
            0,
            0,
            0,
            '',
            '',
            NULL
        )`,

        'createOrder': `INSERT INTO stairs.dbo.Workorders (
            ID,
            OrderNum, 
            Customer, 
            BillingAddress, 
            Address, 
            Model, 
            PONum, 
            JobNum, 
            StairsNum, 
            OrderDate, 
            DeliveryDate, 
            Location, 
            Height, 
            Width, 
            Length, 
            HeadroomMatters, 
            Opening, 
            Joist, 
            Style, 
            StairType, 
            RiserType, 
            Sill,
            Method, 
            OneInchPly,
            HalfInchPly, 
            meas2X6, 
            meas2x10, 
            meas2x12, 
            Status, 
            NumRisers, 
            OSM,
            Type,
            CTR,
            TypeR, 
            ThreeEightTop, 
            Notch, 
            TotalHeight, 
            NumStrcasesInHeight, 
            Materials, 
            StringerStyle1, 
            StringerStyle2, 
            Divisor, 
            CutlistComments, 
            WorkorderComments,
            BillingComments,
            InvoiceComments,
            CustomNumCustomTreads,
            CustomWindersType,
            CustomWindersL,
            CustomWindersR,
            CustomWindersSameWP,
            CustomBullnoseType,
            CustomBullnoseL,
            CustomBullnoseR,
            CustomFlairsType,
            CustomFlairsL,
            CustomFlairsR,
            CustomLandingL,
            WindersAndLandings,
            WorkorderCommentsOverride,
            WinderLocation,
            WinderDirection,
            WinderRise,
            WinderPickup,
            WinderWrap,
            WinderOn1,
            WinderOn3,
            WinderSeat,
            WinderCutCorner,
            Landing_PU,
            Landing_Seat,
            Landing_PU_OSM,
            Landing_Wrap,
            Landing_Wrap_OSM,
            Landing_On_Floor,
            CustomFlairsTypeRight,
            CustomBullnoseTypeRight,
            CustDesc,
            blurb_winder,
            blurb_left_bullnose,
            blurb_right_bullnose,
            blurb_left_flair,
            blurb_right_flair,
            blurb_landing,
            CustomPic,
            Connected,
            ConnectedTo,
            Furred,
            SquareLanding,
            InputBy,
            Quote,
            Edit,
            NoNosing
        )
        VALUES (
            ${args.id},
            ${args.orderNum},
            ${args.customer},
            '${args.billingAddress}',
            '${args.deliveryAddress}',
            ${args.model},
            ${args.po},
            '${args.jobNum}',
            ${args.numOfStairs},
            ${args.orderDate},
            ${args.deliveryDate},
            '',
            0,
            0,
            0,
            0,
            0,
            0,
            1,
            1,
            1,
            0,
            'B',
            0,
            4,
            0,
            -1,
            0,
            0,
            0,
            -1.5,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            'plywood tread, spruce stringers',
            -1,
            -1,
            0,
            '',
            '',
            '',
            '',
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            '',
            '',
            0,
            0,
            0,
            0,
            0,
            0,
            '',
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            0,
            0,
            '',
            0,
            0,
            '${args.input}',
            ${args.quote ? 1 : 0},
            0,
            0
        )`,

        'updateStairOrder': `UPDATE 
                            Workorders
                        SET Location='${args.location}',
                            NumRisers=${args.numberOfRises},
                            Style=${args.stairStyle},
                            StairType=${args.stairType},
                            RiserType=${args.riserType},
                            Length=${args.lngth},
                            Height=${args.height},
                            Width=${args.width},
                            Method='${args.method}',
                            Notch=${args.notch},
                            OSM=${args.osm},
                            HeadroomMatters=${args.headroomMatters},
                            NoNosing=${args.noNosing},
                            Furred=${args.thirdAndFurred},
                            Materials='${args.materials}',
                            StringerStyle1=${args.stringerStyle1},
                            StringerStyle2=${args.stringerStyle2},
                            Divisor=${args.divisor},
                            Connected=${args.connectedToOthers},
                            TotalHeight=${args.totalHeight},
                            NumStrcasesInHeight=${args.numStrcasesInHeight},
                            WindersAndLandings=${args.numberWindersAndLanding},
                            CustomNumCustomTreads=${args.numberOfTreads},
                            ConnectedTo='${args.connectedTo}',
                            CutlistComments='${args.cutlistComments}',
                            WorkorderComments='${args.workorderComments}',
                            BillingComments='${args.billingComments}',
                            InvoiceComments='${args.invoiceComments}',
                            OneInchPly=${args.oneInchPly},
                            HalfInchPly=${args.halfInchPly},
                            meas2X6=${args.meas2X6},
                            meas2X10=${args.meas2X10},
                            meas2X12=${args.meas2X12},
                            blurb_left_flair='${args.blurbLeftFlair}',
                            blurb_right_flair='${args.blurbRightFlair}',
                            blurb_left_bullnose='${args.blurbLeftBullnose}',
                            blurb_right_bullnose='${args.blurbRightBullnose}',
                            CustomFlairsType='${args.customFlairsType}',
                            CustomFlairsTypeRight='${args.customFlairsTypeRight}',
                            CustomBullnoseType='${args.customBullnoseType}',
                            CustomBullnoseTypeRight='${args.customBullnoseTypeRight}'
                        WHERE ID=${args.id}`,
        'updateWinderOrder': `UPDATE 
                            Workorders
                        SET Location='${args.location}',
                            NumRisers=${args.numberOfRises},
                            Style=${args.stairStyle},
                            RiserType=${args.riserType},
                            
                            Connected=${args.connectedToOthers},
                            TotalHeight=${args.totalHeight},
                            NumStrcasesInHeight=${args.numStrcasesInHeight},
                            WindersAndLandings=${args.numberWindersAndLanding},
                            ConnectedTo='${args.connectedTo}',

                            CutlistComments='${args.cutlistComments}',
                            WorkorderComments='${args.workorderComments}',
                            BillingComments='${args.billingComments}',
                            InvoiceComments='${args.invoiceComments}',

                            WinderRise=${args.winderRise},
                            WinderWrap=${args.winderWrap},
                            WinderPickup=${args.winderPickup},
                            WinderOn1=${args.winderOn1},
                            WinderOn3=${args.winderOn3},
                            WinderSeat=${args.winderSeat},
                            WinderLocation='${args.location}',
                            WinderCutCorner=${args.winderCutCorner}
                        WHERE ID=${args.id}`,
        'updateLandingOrder': `UPDATE 
            Workorders
        SET Location='${args.location}',
            
            Connected=${args.connectedToOthers},
            TotalHeight=${args.totalHeight},
            NumStrcasesInHeight=${args.numStrcasesInHeight},
            WindersAndLandings=${args.numberWindersAndLanding},
            ConnectedTo='${args.connectedTo}',

            CutlistComments='${args.cutlistComments}',
            WorkorderComments='${args.workorderComments}',
            BillingComments='${args.billingComments}',
            InvoiceComments='${args.invoiceComments}',

            Landing_PU='${args.landingPickup}',
            Landing_Wrap='${args.landingWrapPlusOneNosing}',
            Landing_Seat='${args.landingSeat}',
            Landing_PU_OSM=${args.landingOsmOnPickup},
            Landing_Wrap_OSM=${args.landingOsmOnWrap},
            Landing_On_Floor=${args.landingSitsOnFloor}
        WHERE ID=${args.id}`
    };

    return queries[queryName];
}

module.exports = getQuery;
