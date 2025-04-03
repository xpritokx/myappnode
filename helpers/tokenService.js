const crypto = require('crypto');

module.exports = {
    createToken: async () => {
        console.log('New token: ', crypto.randomBytes(64).toString('hex'));
    },

    checkUser: async () => {

    },

    deleteToken: async () => {

    }
};