const prioritizeValues = (arr) => {
    const valuesToMove = arr.filter(item => item.Customer === 10);
    const filteredValues = arr.filter(item => valuesToMove.map(i => i.ID).includes(item.ID));
    const remainingValues = arr.filter(item => !valuesToMove.map(i => i.ID).includes(item.ID) && item.Name.length > 3);

    return [...filteredValues, ...remainingValues];
}

// todo temporary no needed
const getModelsForDropdown = async (req, res, next) => {
    const q = req.query;
    const name = q.model || '';
    let whereStatement = ``;

    let searchModelsQuery;

    if (name) {
        whereStatement = `WHERE Models.Name LIKE '%${name}% AND deleted=0 AND isActive=1'`;
    }

    searchModelsQuery = `
        SELECT Models.ID, Models.Name, Models.Customer
        FROM Models
        ${whereStatement}
        ORDER BY Models.Name ASC
    `;

    const models = await req.app.settings.db.query(searchModelsQuery);
    // const modelsData = models.recordset.filter(model => model.Name && model.Name.length > 3);
    const modelsData = prioritizeValues(models.recordset);

    return res.status(200).send({
        total: modelsData.length,
        data: modelsData,
    });
};

const getAllModels = async (req, res, next) => {
    const q = req.query;
    const pageSize = q.pageSize || 25;
    const pageIndex = q.pageIndex || 0;
    const sortingColumn = q.sortingColumn || 'OrderDate'
    const sortingDirection = q.sortingDirection || 'asc';
    const searchField = q.searchField;
    const search = q.search;
    let whereStatement = `WHERE`;
    
    if (searchField) {
        whereStatement += ` ${searchField} LIKE '%${search}%' AND deleted=0 AND isActive=1 AND LEN(Name) > 3`;
    }

    let searchCountQuery;

    if (whereStatement) {
        searchCountQuery = `
            SELECT 
                COUNT(DISTINCT Models.ID) AS 'total' 
            FROM Models
            ${whereStatement.length === 5 ? 'WHERE deleted=0 AND isActive=1 AND LEN(Name) > 3' : whereStatement}
        `;
    } else {
        searchCountQuery = `
            SELECT 
                COUNT(DISTINCT Models.ID) AS 'total' 
            FROM Models
            WHERE deleted=0 AND isActive=1 AND LEN(Name) > 3
        `;
    }

    const searchQuery = `
        SELECT
            Models.ID,
            Models.Name, 
            Models.Workorder
        FROM Models
        ${whereStatement.length === 5 ? 'WHERE deleted=0 AND isActive=1 AND LEN(Name) > 3' : whereStatement}
        ORDER BY ${sortingColumn} ${sortingDirection}
        OFFSET ${ pageSize * pageIndex } ROWS FETCH NEXT ${pageSize} ROWS ONLY;
    `;

    console.log('--DEBUG-- searchQuery models: ', searchQuery)
    console.log('--DEBUG-- searchCountQuery models: ', searchCountQuery)

    Promise.all([
        req.app.settings.db.query(searchCountQuery),
        req.app.settings.db.query(searchQuery)
    ]).then(result => {
        const total = result[0].recordset[0].total;
        let data = result[1].recordset;

        return res.status(200).send({
            status: 'ok',
            total: total,
            data: data,
        });
    }).catch(err => {
        return res.status(400).send({
            status: 'error',
            error: 'Error happened during \'Getting models\' DB operation',
            message: err.message
        });
    });
};

const addModel = async (req, res, next) => {
    const body = req.body;
    const name = body.name;
    const takeLastModelQuery = `
        SELECT TOP 1 Models.ID
        FROM Models
        ORDER BY Models.ID DESC
    `;

    if (name.length <= 3) {
        return res.status(400).send({
            status: 'error',
            message: 'Name of model should be more than 3 symbols',
            error: 'Name of model should be more than 3 symbols',
        });
    }

    const checkModelWithSameNameQuery = `
        SELECT Models.Name
        FROM Models
        WHERE Models.Name='${name}'
    `;

    const modelWithSameName = await req.app.settings.db.query(checkModelWithSameNameQuery);

    if (modelWithSameName.recordset.length > 0) {
        return res.status(400).send({
            status: 'error',
            message: 'Models with same name is already exists',
            error: 'Models with same name is already exists',
        });
    }

    const lastModelNumberData = await req.app.settings.db.query(takeLastModelQuery);
    const id = lastModelNumberData.recordset[0].ID + 1;

    console.log('--DEBUG-- lastModelNumberData.recordset[0].ID + 1 ', id);

    const createModelQuery = `
        INSERT INTO stairs.dbo.Models (
            ID,
            Name,
            Customer,
            Workorder,
            isActive,
            deleted
        )
        VALUES (
            ${id},
            '${name}',
            ${body.customer || 0},
            ${body.workorder || 0},
            1,
            0
        )`;
    
    try {
        await req.app.settings.db.query(createModelQuery);
    } catch (err) {
        return res.status(400).send({
            status: 'error',
            message: err.message,
            error: 'Error happened during \'Creating model\' DB operation',
        });
    }

    res.status(200).send({
        status: 'success',
        id,
        name
    });
}

const removeModel = async (req, res, next) => {
    const params = req.params;
    const id = params.id;
    let deleteModelQuery;

    deleteModelQuery = `UPDATE stairs.dbo.Models SET deleted=1 WHERE ID=${id}`;
    console.log('--DEBUG-- deleteModelQuery: ', deleteModelQuery);

    const checkWorkordersWithThatModel = `
        SELECT ID, OrderNum
        FROM Workorders
        WHERE Workorders.Model=${id}
    `;

    const workordersWithThatModel = await req.app.settings.db.query(checkWorkordersWithThatModel);

    console.log('--DEBUG-- workordersWithThatModel: ', workordersWithThatModel);

    if (workordersWithThatModel.recordset.length > 0) {
        return res.status(400).send({
            status: 'error',
            message: `Workorders (${workordersWithThatModel.recordset[0].OrderNum}) with this model is already exists`,
            error: `Workorders (${workordersWithThatModel.recordset[0].OrderNum}) with this model is already exists`,
        });
    }

    try {
        await req.app.settings.db.query(deleteModelQuery);
    } catch (err) {
        return res.status(400).send({
            status: 'error',
            message: err.message,
            error: 'Error happened during \'Deleting model\' DB operation',
        });
    }

    return res.status(200).send({
        status: 'ok'
    });
}

module.exports = {
    getModelsForDropdown,
    getAllModels,
    addModel,
    removeModel,
}