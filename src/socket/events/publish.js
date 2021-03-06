const uuidV1 = require('uuid').v1
const debug = require('debug')('socket:publish')
require("colors")

let client = require('../client')
const verify = require('../../utils/verify')

/**
 * Publishes the output data on the manager
 * @param {Object} data The actual data package that should be published
 */
let publish = async function (package, { statusID = undefined, key, resolvePromise, ttl = undefined } = {}) {
    try {
        //append ttl to meta
        if (ttl) {
            package.meta.ttl = ttl
        }

        verify.appendSignature(package, key)

        //append non signature relevant information here
        package._id = uuidV1()
        package.statusID = statusID

        await client.socket.transmit({ topic: 'data', message: package, eventID: package._id, resolvePromise })

        return { data: package.data, id: package._id }
    } catch (error) {
        debug(error.message.red)
    }
}

module.exports = publish
