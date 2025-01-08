module.exports = (req, res, next) => {
    if (req?.headers?.authorization === 'Bearer e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855') {
        console.log(`--DEBUG-- ${req.originalUrl}`);
        return next();
    }

    console.log(`--DEBUG-- ${req.originalUrl} auth middleware authorization not passed!`, req.headers?.authorization);

    return res.status(401)
        .send({
            status: 'error',
            reason: 'Credentials aren\'t valid',
        });
};