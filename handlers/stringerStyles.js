let getStringerStyles = async (req, res, next) => {
    const searchStringerStylesQuery = `
        SELECT ID, StringerStyles
        FROM StringerStyles
        ORDER BY ID ASC
    `;

    const stringerStyles = await req.app.settings.db.query(searchStringerStylesQuery);
    const stringerStylesData = stringerStyles.recordset;

    return res.status(200).send({
        total: stringerStylesData.length,
        data: stringerStylesData,
    });
};

module.exports = {
    getStringerStyles,
}