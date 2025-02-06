let getStairTypes = async (req, res, next) => {
    const searchStairTypesQuery = `
        SELECT ID, StairType
        FROM StairTypes
        ORDER BY ID ASC
    `;

    const stairTypes = await req.app.settings.db.query(searchStairTypesQuery);
    const stairTypesData = stairTypes.recordset;

    return res.status(200).send({
        total: stairTypesData.length,
        data: stairTypesData,
    });
};

module.exports = {
    getStairTypes,
}