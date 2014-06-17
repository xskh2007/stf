module.exports = function DeviceListCtrlDetails($scope, DeviceService, GroupService, ControlService, ngTableParams, SettingsService, $filter, $location, gettext, $q) {

  // TODO: this is not working, why?
  $scope.filterEnabled = false
  SettingsService.bind($scope, {
    key: 'filterEnabled', storeName: 'DeviceList.filterEnabled'
  })


  $scope.statusFilter = function () {
    var def = $q.defer()
    var statuses = [
      { id: true, title: gettext('Available')
      }
      ,
      { id: false, title: gettext('N/A')
      }
    ]
    def.resolve(statuses)
    return def
  }

  $scope.tableFilter = {
    usable: ''
  }
//  SettingsService.bind($scope, {
//    key: 'tableFilter',
//    storeName: 'DeviceList.tableFilter'
//  })

  var initialSorting = {
    enhancedStateSorting: 'asc',
    enhancedName: 'asc'
  }
  $scope.tableSorting = initialSorting

  $scope.clearSorting = function () {
    $scope.tableParams.sorting(initialSorting)
    $scope.tableParams.filter({})
  }

//  SettingsService.bind($scope, {
//    key: 'tableSorting',
//    storeName: 'DeviceList.tableSorting'
//  })

//  $scope.$watchCollection('tableParams.sorting()', function (data) {
//    $scope.tableSorting = data
//  })
//
//  $scope.$watchCollection('tableParams.filter()', function (data) {
//    $scope.tableFilter = data
//  })

  $scope.tableParams = new ngTableParams(
    { filter: $scope.tableFilter, sorting: $scope.tableSorting
    }
    , { total: 1, counts: [], filterDelay: 0, getData: function ($defer, params) {
      var data = $scope.tracker.devices

      var filteredData = params.filter() ?
        $filter('filter')(data, params.filter()) :
        data

      var orderedData = params.sorting() ?
        $filter('orderBy')(filteredData, params.orderBy()) :
        data

      $defer.resolve(orderedData)
    }
    })

  $scope.$on('devices.update', function () {
    $scope.tableParams.reload()
  })

  $scope.userContactUrl = function (mail) {
    var config = {
      hipchatEnabled: true,
      hipchatUrl: 'https://cyberagent.hipchat.com/chat?focus_jid='
    }

    if (config.hipchatEnabled) {
      return config.hipchatUrl + mail
    } else {
      return 'mailto:' + mail
    }
  }

  $scope.tryToKick = function (device) {
    var config = {
      kickingEnabled: true
    }

    if (config.kickingEnabled) {
      if (device.state === 'busy') {
        if (confirm($filter('translate')(
          gettext('Are you sure you want to kick this device?\nCurrently it is being used by ')) + device.owner.name)) {
          $scope.kick(device, true)
        }
      }
    }
  }



  // TODO: Implement real dynamic colums! Using showAll is too slow


  $scope.dynamicColumns = [
    { title: 'Model', field: 'enhancedModel', sortable: 'enhancedModel', filter: {enhancedModel: 'text'}, visible: true
    }
    ,
    { title: 'Product', field: 'enhancedName', sortable: 'enhancedName', filter: {enhancedName: 'text'}, visible: true
    }
    ,
    { title: 'Carrier', field: 'operator', sortable: 'operator', filter: {operator: 'text'}, visible: true
    }
  ]

  $scope.selectedColumns = [$scope.dynamicColumns[1]]
}
