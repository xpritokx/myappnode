let getMaterials = async (req, res, next) => {
    const searchMaterialsQuery = `
        SELECT ID, Material
        FROM Materials
        ORDER BY ID ASC
    `;

    const materials = await req.app.settings.db.query(searchMaterialsQuery);
    const materialsData = materials.recordset;

    return res.status(200).send({
        total: materialsData.length,
        data: materialsData,
    });
};

module.exports = {
    getMaterials,
}