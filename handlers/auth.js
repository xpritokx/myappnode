// const user = "Roman";
// const pass = "Roman";

let check = async (req, res, next) => {
    console.log('--DEBUG-- check [body] ', req.body);
    
    let getUserDataQuery = `
        SELECT 
            ID, Name, token
        FROM 
            stairs_server.dbo.Employee 
        WHERE Name=${req?.body?.username} password=${req?.body?.pass}`;
        
    let userData = await req.app.settings.db.query(getUserDataQuery);

    if (
        !userData.recordset ||
        !userData.recordset.length
    ) {
        res.status(401)
            .send({
                status: 'error',
                reason: 'Credentials aren\'t valid',
            });
    }



    res.status(200)
        .send({
            status: 'ok',
            token: ''
            //token: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        });
}

module.exports = {
    check,
}