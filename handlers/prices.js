const changePrice = async (req, res, next) => {
    const params = req.params;
    const id = params.id;
    const body = req.body;

    const updateQuery = `UPDATE 
                            pricelist
                        SET UnitPrice=${body.unitPrice}
                        WHERE ID=${id}`;

    await req.app.settings.db.query(updateQuery);

    return res.status(200).send({
        status: 'success'
    });
}

const getPricesByOrderNum = async (req, res, next) => {
    const params = req.params;
    const orderNum = params.orderNum;
    let whereStatement = ``;

    let searchPricesQuery;

    whereStatement = `WHERE PricingView.OrderNum=${orderNum}`;

    searchPricesQuery = `
        SELECT 
            PricingView.PriceID, 
            PricingView.PriceCode, 
            PricingView.UnitPrice, 
            PricingView.Unit, 
            PricingView.Description, 
            PricingView.Tax, 
            PricingView.Tier,
            PricingView.Amount
        FROM PricingView
        ${whereStatement}
        ORDER BY PricingView.PriceCode ASC
    `;

    const prices = await req.app.settings.db.query(searchPricesQuery);
    const pricesData = prices.recordset || [];

    return res.status(200).send({
        total: pricesData.length,
        data: pricesData,
    });
};

const getAllPrices = async (req, res, next) => {
    let searchPricesQuery;

    searchPricesQuery = `
        SELECT 
            pricelist.ID, 
            pricelist.PriceCode, 
            pricelist.UnitPrice, 
            pricelist.Unit, 
            pricelist.Description, 
            pricelist.Tax, 
            pricelist.Catagory
        FROM pricelist
        ORDER BY pricelist.PriceCode ASC
    `;

    const prices = await req.app.settings.db.query(searchPricesQuery);
    const pricesData = prices.recordset || [];

    return res.status(200).send({
        total: pricesData.length,
        data: pricesData,
    });
}

module.exports = {
    changePrice,
    getAllPrices,
    getPricesByOrderNum,
}