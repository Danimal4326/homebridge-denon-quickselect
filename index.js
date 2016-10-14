const request = require('request')
const xml2js = require('xml2js')
let Service, Characteristic

module.exports = function(homebridge) {
  Characteristic = homebridge.hap.Characteristic
  Service = homebridge.hap.Service

  homebridge.registerAccessory('homebridge-denon-quickselect', 'denon-quickselect', DenonQuickselect)
}

function DenonQuickselect(log, config) {
    this.log = log
    this.name = config.name
    this.host = config.host
    this.quickselect = config.quickselect || 1
    this.zone = (config.zone || 1) | 0

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
  callback(null, 0)
}

DenonQuickselect.prototype.setQuickSelect = function(value, callback) {
  const xml = this.buildXml({
    cmd: {
        attr: { id: '1' },
        val: 'SetQuickSelect'
    },
    zone: this.zoneName,
    value: this.quickselect
  })

  this.doRequest(xml).then(resp => {
    this.log('switch to ', this.quickselect, this.zoneName, JSON.stringify(resp.rx))
    callback()
  })
  .catch(e => { this.log.warn(e) })
}

DenonQuickselect.prototype.getServices = function() {
  var informationService = new Service.AccessoryInformation()
  informationService
    .setCharacteristic(Characteristic.Manufacturer, 'Denon')
    .setCharacteristic(Characteristic.Model, 'Quickselect')
    .setCharacteristic(Characteristic.SerialNumber, 'QS ' + this.quickselect)

  var switchService = new Service.Switch(this.name)
  switchService
    .getCharacteristic(Characteristic.On)
    .on('get', this.getState.bind(this))
    .on('set', this.setQuickSelect.bind(this))

  return [informationService, switchService]
}
