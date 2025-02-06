let getStairStyles = async (req, res, next) => {
    const searchStairStylesQuery = `
        SELECT ID, StairStyle
        FROM StairStyles
        ORDER BY ID ASC
    `;

    const stairStyles = await req.app.settings.db.query(searchStairStylesQuery);
    const stairStylesData = stairStyles.recordset;

    return res.status(200).send({
        total: stairStylesData.length,
        data: stairStylesData,
    });
};

module.exports = {
    getStairStyles,
}