let getRiserTypes = async (req, res, next) => {
    const searchRiserTypesQuery = `
        SELECT ID, RiserType
        FROM RiserTypes
        ORDER BY ID ASC
    `;

    const riserTypes = await req.app.settings.db.query(searchRiserTypesQuery);
    const riserTypesData = riserTypes.recordset;

    return res.status(200).send({
        total: riserTypesData.length,
        data: riserTypesData,
    });
};

module.exports = {
    getRiserTypes,
}