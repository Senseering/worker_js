const NodeRSA = require('node-rsa')
const config = require('./utils/config/config')
const debug = require('debug')('worker')
const compare = require("./socket/methods/compare")
const update = require("./socket/methods/update")
const change = require("./socket/methods/change")
require('colors')

const client = require('./socket/client')
const publish = require('./socket/events/publish')
const register = require('./socket/events/register')
const status = require('./socket/events/status')

/**
 * Is used to register at a manager with the necessary options given. It checks if the worker is
 * registered and registers it automatically if not.
 * @param {Object} params Object which configures the worker
 */
function Worker() {

}


/**
 * Connect should establish the websocket connection to the manager and register the worker
 * or load all required data like id, keys and templates
 */
Worker.prototype.connect = async function (location) {
    await config.init(location)
    this.community = false
    if ((await config.get('schema')).hasOwnProperty("community")) {
        this.community = true
    }
    this.completeManagerLink = (new URL(await config.get('url'))).host
    debug('Connecting client...')
    await client.init()


    //register worker if not already done in the past
    this.key = new NodeRSA(await config.get('privKey'))

    debug('Registering worker')
    await updateConfig()
    client.onUpdate = updateConfig
    debug('Initialisation done')
}

let updateConfig = async function () {
    for (let i = 0; i < (await config.get("settings")).messageRetries; i++) {
        try {
            debug("Retrieving worker version ...")
            let version = await config.getVersion()
            debug("Comparing changes with manager ...")
            let changes = await compare.send(version)
            debug("Comparing changes locally ...")
            if (changes.split(".").map((change) => !Boolean(Number(change))).reduce((a, b) => a && b))
                break; // Leave loop if no changes detected
            debug("Transferin local changes ...")
            let missingConfig = await config.getChanges(changes)
            await update.send(missingConfig)
            if (Object.keys(missingConfig).length > 0) {
                if (changes.split(".").map((change) => change === "-1").reduce((a, b) => a || b)) {
                    // If there is one change that is newer on manager request the change
                    // TODO add no changes allowed worker
                    let updates = await change.send(changes)
                    for (const update of Object.keys(updates)) {
                        try {
                            await config.update(update, updates[update], { recursive: true })
                        } catch (error) {
                            throw new Error("Update from remote failed: " + error.message)
                        }
                    }
                }
            }

        } catch (err) {
            if (i === (await config.get("settings")).messageRetries - 1)
                throw err
        }
    }
}


/**
 * This will publish data on the manager
 *
 * @param {Object} data The data to be published
 */
Worker.prototype.publish = async function (data, options) {
    if (options === undefined) {
        options = {}
    }
    debug('Preparing data for publish on manager...')
    let result
    let meta = {
        worker_id: (await config.get('credentials')).split(":")[0],
        created_at: Date.now(),
        price: options.price === undefined ? 0 : options.price,
        location: (await config.get('profile')).location
    }
    //append basedOn property just in case of service
    if (Object.keys((await config.get('schema')).input).length) {
        meta.basedOn = {
            workerIDs: [],
            dataIDs: [[]]
        }
    }

    let receivePromise = new Promise(async (resolve, reject) => {
        try {
            result = await publish({ meta, data }, { statusID: undefined, key: this.key, resolvePromise: resolve, ttl: options.ttl })
        } catch (err) {
            reject(err)
        }
    })
    await receivePromise

    return result
}


/**
 * This sets the service function that can be triggered and executed on demand
 *
 * @param {Object} service The function that can be triggered and executed on demand
 */
Worker.prototype.provide = async function (service) {
    debug('Setting service function...')

    //set trigger
    const Trigger = require('./trigger/trigger')
    this.trigger = new Trigger(this.key, service)
}


/**
 * This disconnects the client from the manager
 */
Worker.prototype.disconnect = async function () {
    debug('Disconnecting client...')
    await client.disconnect()
}

module.exports = Worker
