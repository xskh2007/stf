var oboe = require('oboe')
var _ = require('lodash')

module.exports = function DeviceServiceFactory($http, socket, $filter) {
  var deviceService = {}

  function Tracker($scope, options) {
    var devices = []
      , devicesBySerial = Object.create(null)
      , scopedSocket = socket.scoped($scope)
      , digestTimer
      , lastDigest

    $scope.$on('$destroy', function() {
      clearTimeout(digestTimer)
    })

    function digest() {
      $scope.$broadcast('devices.update', true)

      // Not great. Consider something else
      if (!$scope.$$phase) {
        $scope.$digest()
      }

      lastDigest = Date.now()
      digestTimer = null
    }

    function notify(event) {
      if (event.important) {
        // Handle important updates immediately.
        //digest()
        window.requestAnimationFrame(digest)
      }
      else {
        if (!digestTimer) {
          var delta = Date.now() - lastDigest
          if (delta > 1000) {
            // It's been a while since the last update, so let's just update
            // right now even though it's low priority.
            digest()
          }
          else {
            // It hasn't been long since the last update. Let's wait for a
            // while so that the UI doesn't get stressed out.
            digestTimer = setTimeout(digest, delta)
          }
        }
      }
    }

    function sync(data) {
      // usable IF device is physically present AND device is online AND
      // preparations are ready AND the device has no owner or we are the
      // owner
      data.usable = data.present && data.status === 3 && data.ready &&
        (!data.owner || data.using)

      // Make sure we don't mistakenly think we still have the device
      if (!data.usable) {
        data.using = false
      }

      // For convenience, formulate an aggregate state property that covers
      // every possible state.
      data.state = 'absent'
      if (data.present) {
        data.state = 'present'
        switch (data.status) {
          case 1:
            data.state = 'offline'
            break
          case 2:
            data.state = 'unauthorized'
            break
          case 3:
            data.state = 'preparing'
            if (data.ready) {
              data.state = 'ready'
              if (data.using) {
                data.state = 'using'
              }
              else {
                if (data.owner) {
                  data.state = 'busy'
                }
                else {
                  data.state = 'available'
                }
              }
            }
            break
        }
      }

      $scope.$broadcast('device.synced', data)
    }


    function get(data) {
      return devices[devicesBySerial[data.serial]]
    }

    function insert(data) {
      devicesBySerial[data.serial] = devices.push(data) - 1
      sync(data)
    }

    function modify(data, newData) {
      _.merge(data, newData, function(a, b) {
        // New Arrays overwrite old Arrays
        return _.isArray(b) ? b : undefined
      })
      sync(data)
    }

    function remove(data) {
      var index = devicesBySerial[data.serial]
      if (index >= 0) {
        devices.splice(index, 1)
        delete devicesBySerial[data.serial]
      }
    }

    function fetch(data) {
      deviceService.load(data.serial)
        .then(function(device) {
          return changeListener({
            important: true
          , data: device
          })
        })
        .catch(function() {})
    }

    function addListener(event) {
      var device = get(event.data)
      if (device) {
        modify(device, event.data)
        notify(event)
      }
      else {
        if (options.filter(event.data)) {
          insert(event.data)
          notify(event)
        }
      }
    }

    function changeListener(event) {
      var device = get(event.data)
      if (device) {
        modify(device, event.data)
        if (!options.filter(device)) {
          remove(device)
        }
        notify(event)
      }
      else {
        if (options.filter(event.data)) {
          insert(event.data)
          // We've only got partial data
          fetch(event.data)
          notify(event)
        }
      }
    }

    scopedSocket.on('device.add', addListener)
    scopedSocket.on('device.remove', changeListener)
    scopedSocket.on('device.change', changeListener)

    this.add = function(device) {
      remove(device)
      insert(device)
      notify({
        important: true
      , data: device
      })
    }

    this.devices = devices
  }

  deviceService.trackAll = function ($scope) {
    var tracker = new Tracker($scope, {
      filter: function() {
        return true
      }
    })

    oboe('/api/v1/devices')
      .node('devices[*]', function (device) {
        tracker.add(device)
      })

    return tracker
  }

  deviceService.trackGroup = function ($scope) {
    var tracker = new Tracker($scope, {
      filter: function(device) {
        return device.using
      }
    })

    oboe('/api/v1/group')
      .node('devices[*]', function (device) {
        tracker.add(device)
      })

    return tracker
  }

  deviceService.load = function(serial) {
    return $http.get('/api/v1/devices/' + serial)
      .then(function (response) {
        return response.data.device
      })
  }

  deviceService.get = function (serial, $scope) {
    var tracker = new Tracker($scope, {
      filter: function(device) {
        return device.serial === serial
      }
    })

    return deviceService.load(serial)
      .then(function(device) {
        tracker.add(device)
        return device
      })
  }

  return deviceService
}
