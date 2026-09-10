import EventEmitter from 'events'

// Initialize
const eventEmitter = new EventEmitter()
eventEmitter.setMaxListeners(50)

export default eventEmitter
