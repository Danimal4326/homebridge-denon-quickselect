const request = require('request')
const xml2js = require('xml2js')
let Service, Characteristic

module.exports = function(homebridge) {
  Characteristic = homebridge.hap.Characteristic
  Service = homebridge.hap.Service

  homebridge.registerAccessory('@danimal4326/homebridge-denon-quickselect', 'denon-quickselect', DenonQuickselect)
}

function DenonQuickselect(log, config) {
    this.log = log
    this.name = config.name
    this.host = config.host
    this.quickSelect = config.quickSelect || 1
    this.defaultQuickSelect = config.defaultQuickSelect
    this.zone = (config.zone || 1) | 0
    this.pingUrl = config.pingUrl
    this.matchSource = config.matchSource
    this.matchSurroundMode = config.matchSurroundMode

    if (this.zone < 1 && this.zone > 2) {
        this.log.warn('Zone number is not recognized (must be 1 or 2) - assuming zone 1')
        this.zone = 1
    }

    this.zoneName = this.zone === 1 ? 'Main' : 'Zone2'
}

DenonQuickselect.prototype.buildXml = function(obj) {
  var builder = new xml2js.Builder({ rootName: 'tx', attrkey: 'attr', charkey: 'val' })
  return builder.buildObject(obj)
}

DenonQuickselect.prototype.doRequest = function(data) {
  const url = 'http://' + this.host + '/goform/AppCommand.xml'
  return new Promise((resolve, reject) => {
    request.post({url : url, body: data}, (error, response, body) => {
      if(error || response.statusCode !== 200) {
          return reject(error)
      }

      xml2js.parseString('' + body, function (err, result) {
        if(err) reject(error)
        else    resolve(result)
      })
    })
  })
}

DenonQuickselect.prototype.getState = function(callback) {
  const xml = this.buildXml({
    cmd: [
      { attr: { id: '1' }, val: 'GetAllZonePowerStatus' },
      { attr: { id: '2' }, val: 'GetAllZoneSource' },
      { attr: { id: '2' }, val: 'GetSurroundModeStatus' }
    ]
  })
  
  this.doRequest(xml).then(resp => {
    const power = resp.rx.cmd[0].zone1[0] === 'ON'
    const source = resp.rx.cmd[1].zone1[0].source[0] === this.matchSource
    const mode = resp.rx.cmd[2].surround[0].trim() === this.matchSurroundMode
    
    if (this.matchSource)
        powerState = (power && source) ? 1 : 0
    else if (this.matchSurroundMode)
        powerState = mode
    else
        powerState = power
 
    callback(null, powerState)
  })
  .catch(e => { this.log.warn(e) })
}

DenonQuickselect.prototype.setQuickSelect = function(value, callback) {
  if(this.pingUrl && value) {
    request.get(this.pingUrl, (error, response, body) => {
      this.log(`pinged ${this.pingUrl} - got: ${error} and ${response.statusCode}}`)
    })
  }
  
  const xml = this.buildXml({
    cmd: { attr: { id: '1' }, val: 'SetQuickSelect' },
    zone: this.zoneName,
    value: (value ? this.quickSelect : this.defaultQuickSelect)
  })

  this.doRequest(xml).then(resp => {
    this.log('switch to quickSelect:', (value ? this.quickSelect : this.defaultQuickSelect), " zone: ", this.zoneName, " resp: ", JSON.stringify(resp.rx))
    callback()
  })
  .catch(e => { this.log.warn(e) })
}

DenonQuickselect.prototype.getServices = function() {
  var informationService = new Service.AccessoryInformation()
  informationService
    .setCharacteristic(Characteristic.Manufacturer, 'Denon')
    .setCharacteristic(Characteristic.Model, 'Quickselect')
    .setCharacteristic(Characteristic.SerialNumber, 'QS ' + this.quickSelect)

  var switchService = new Service.Switch(this.name)
  switchService
    .getCharacteristic(Characteristic.On)
    .on('get', this.getState.bind(this))
    .on('set', this.setQuickSelect.bind(this))

  return [informationService, switchService]
}
