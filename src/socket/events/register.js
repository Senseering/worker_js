const debug = require('debug')('socket:register')
require('colors')

let client = require('../client')
const format = require("../../utils/formatMessages")


/**
 * Registers worker at the manager
 * @param {Object} registration the needed data package to register
 */
let register = async function (registration) {
    try {
        /*if (client.socket.readyState == 1) {
            client.socket.send(format.output('register', registration))
        } else {
            client.waitingQueue.push(format.output('register', registration))
        }*/
        client.socket.emit(format.output('register', registration))
    } catch (error) {
        debug(('Error: ' + error).red)
    }
}

module.exports = register
