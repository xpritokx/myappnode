const user = "Roman";
const pass = "Roman";

let check = (req, res, next) => {
    console.log('--DEBUG-- check [body] ', req.body);
    
    if (req?.body?.username !== user ||
        req?.body?.password !== pass
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
            token: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        });
}

module.exports = {
    check,
}