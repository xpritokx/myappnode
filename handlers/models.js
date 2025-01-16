let getModels = async (req, res, next) => {
    const q = req.query;
    const name = q.model || '';
    let whereStatement = ``;

    let searchModelsQuery;

    if (name) {
        whereStatement = `WHERE Models.Name LIKE '%${name}%'`;
    }

    searchModelsQuery = `
        SELECT Models.ID, Models.Name
        FROM Models
        ${whereStatement}
        ORDER BY Models.Name ASC
    `;

    const models = await req.app.settings.db.query(searchModelsQuery);
    const modelsData = models.recordset.filter(model => model.Name && model.Name.length > 3);

    return res.status(200).send({
        total: modelsData.length,
        data: modelsData,
    });
};

module.exports = {
    getModels,
}