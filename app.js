const http = require('http'),
    config = require('./config.json');

console.log("Init RouterStats");

// Empty Vars
let headers = {},
    formattedJson = {};

// Build BASIC auth
let authBase64 = "Basic " + Buffer.from(config.auth.username + ":" + config.auth.password).toString('base64');
if(config.debug)console.log("Authorisation: " + authBase64);
headers.Authorization = authBase64;


// GET Router Vars
http.get({
    hostname: config.routerIP,
    port: config.routerPort,
    path: '/sky_st_poe.html',
    headers: headers
}, (res) => {
    if(config.debug)console.log("Got response: " + res.statusCode);
    if(res.statusCode === 200){
        if(config.debug)console.log("Logged IN");

        let responseString = "";
        res.on("data", function(chunk) {
            responseString += chunk;
        });

        res.on("end", function () {
            if(config.debug)console.log(responseString);
            // get Wan Status
            let respArr = responseString.split(/wanStatus = '(.*)';/)[1].split(/_/);
            formattedJson.publicIPv4 = respArr[5];
            formattedJson.publicIPv6 = respArr[12];

            formattedJson.defaultDNSIP = respArr[10];
            formattedJson.routerMac = respArr[6];
            formattedJson.routerNetMask = respArr[7];

            let uptime = respArr[11].split(/:/);
            formattedJson.upTime = {};
            formattedJson.upTime.hours = uptime[0];
            formattedJson.upTime.minutes = uptime[1];
            formattedJson.upTime.seconds = uptime[2];

            if(config.debug)console.log(formattedJson);

            // get Modem Status
            let modem_stat = responseString.split(/Modem_stat = '(.*)';/);
            formattedJson.modemStatus = modem_stat[1];
            console.log("Done Router Vars");
        });
    }else if(res.statusCode === 401){
        console.log("Wrong Credentials");
    }else{
        console.log("HTTP ERROR | Response code - " + res.statusCode);
    }

}).on('error', function(e) {
    console.log("Got error: " + e.message);
});


// GET Stats and Links status
http.get({
    hostname: config.routerIP,
    port: config.routerPort,
    path: '/sky_system.html',
    headers: headers
}, (res) => {
    if(config.debug)console.log("Got response: " + res.statusCode);
    if(res.statusCode === 200){
        if(config.debug)console.log("Logged IN");

        let responseString = "";
        res.on("data", function(chunk) {
            responseString += chunk;
        });

        res.on("end", function () {
            if(config.debug)console.log(responseString);

            // Get UpTime
            let uptime = responseString.split(/(Time:<\/span>)(?=.|\n)(.|\n)    (.*)(.|\n)/)[3].split(/:/);
            formattedJson.upTime = {};
            formattedJson.upTime.hours = uptime[0];
            formattedJson.upTime.minutes = uptime[1];
            formattedJson.upTime.seconds = uptime[2];

            // get tables from html
            let tables = responseString.split(/(<table class="nospace" width="100%" border="0" cellpadding="0" cellspacing="0">)([\s\S]*?)(<\/table>)/),
                table1 = tables[2],
                table2 = tables[6],
                table1storage = {},
                table2storage = {};

            // Table 1 | Status
            let table1TR = table1.split(/(<tr>)([\s\S]*?)(<\/tr>)/),
                table1iteration = 0;
            table1TR.forEach(function(entry) {
                let tableTD = entry.split(/(<td>)([\s\S]*?)(<\/td>)/);
                let thisStorage;
                if (tableTD[2]) {
                    if (table1iteration === 1) {
                        table1storage.WAN = {};
                        thisStorage = table1storage.WAN;
                    } else if (table1iteration === 2) {
                        table1storage.LAN = {};
                        thisStorage = table1storage.LAN;
                    } else if (table1iteration === 3) {
                        table1storage.WLAN = {};
                        thisStorage = table1storage.WLAN;
                    } else {
                        thisStorage = null;
                    }

                    if (thisStorage) {
                        thisStorage.status = tableTD[6];
                        thisStorage.TxPkts = tableTD[10];
                        thisStorage.RxPkts = tableTD[14];
                        thisStorage.collisions = tableTD[18];
                        thisStorage.TXs = tableTD[22];
                        thisStorage.RXs = tableTD[26];
                        thisStorage.upTime = {};
                        let uptime = tableTD[30].split(/:/);
                        thisStorage.upTime.hours = uptime[0];
                        thisStorage.upTime.minutes = uptime[1];
                        thisStorage.upTime.seconds = uptime[2];
                    }
                    table1iteration++;
                }
            });

            // Table 2 | Links
            let table2TR = table2.split(/(<tr>)([\s\S]*?)(<\/tr>)/),
                table2iteration = 0;
            table2TR.forEach(function(entry) {
                let tableTD = entry.split(/(<td>)([\s\S]*?)(<\/td>)/);

//                console.log(tableTD);
                let thisStorage;
                if(tableTD[2]){
                    if(table2iteration === 1){
                        table2storage.ConnSpeed = {};
                        thisStorage = table2storage.ConnSpeed;
                        thisStorage.DownStream = tableTD[6];
                        thisStorage.UpStream = tableTD[10];
                    }else if(table2iteration === 2){
                        table2storage.LineAtt = {};
                        thisStorage = table2storage.LineAtt;
                        thisStorage.DownStream = tableTD[6];
                        thisStorage.UpStream = tableTD[10];
                    }else if(table2iteration === 3){
                        table2storage.NoiseMargin = {};
                        thisStorage = table2storage.NoiseMargin;
                        thisStorage.DownStream = tableTD[2];
                        thisStorage.UpStream = tableTD[6];
                    }
                    table2iteration++;
                }
            });
            console.log("Done Stats");
            formattedJson.stats = {};
            formattedJson.stats.connections = table1storage;
            formattedJson.stats.links = table2storage;
        });
    }else if(res.statusCode === 401){
        console.log("Wrong Credentials");
    }else{
        console.log("HTTP ERROR | Response code - " + res.statusCode);
    }

}).on('error', function(e) {
    console.log("Got error: " + e.message);
});


// GET Connected devices, IPV4 and IPV6
http.get({
    hostname: config.routerIP,
    port: config.routerPort,
    path: '/sky_attached_devices.html',
    headers: headers
}, (res) => {
    if(config.debug)console.log("Got response: " + res.statusCode);
    if(res.statusCode === 200){
        if(config.debug)console.log("Logged IN");

        let responseString = "";
        res.on("data", function(chunk) {
            responseString += chunk;
        });

        res.on("end", function () {
            if(config.debug)console.log(responseString);
            let devices = responseString.split(/attach_dev = '(.*)';/)[1].split(/<lf>/);
            let storage = {},
                ipv4iteration = 0,
                ipv6iteration = 0;
            devices.forEach(function(entry) {
                let fields = entry.split(/<br>/);
                if(fields[3] === "-"){
                    //This device is IPV4 only
                    if(!storage.IPV4)storage.IPV4 = {};
                    storage.IPV4[ipv4iteration] = {};
                    let thisIP = storage.IPV4[ipv4iteration];
                    thisIP.ip = fields[2];
                    thisIP.mac = fields[0];
                    thisIP.name = fields[1];
                    ipv4iteration++;
                }else{
                    //This device supports IPV6
                    if(!storage.IPV6)storage.IPV6 = {};
                    storage.IPV6[ipv6iteration] = {};
                    let thisIP = storage.IPV6[ipv6iteration],
                        ipv6 = fields[4].split("\\n\\n");
                    if(!ipv6[2]){
                        thisIP.ip = ipv6[1];
                    }else{
                        thisIP.ip = ipv6[2];
                    }
                    thisIP.mac = fields[0];
                    thisIP.name = fields[1];
                    ipv6iteration++;
                }

            });
            console.log("Done Connected Devices");
            formattedJson.devices = storage;
        });
    }else if(res.statusCode === 401){
        console.log("Wrong Credentials");
    }else{
        console.log("HTTP ERROR | Response code - " + res.statusCode);
    }

}).on('error', function(e) {
    console.log("Got error: " + e.message);
});


// GET SSID, Admin IP, AuthMode
http.get({
    hostname: config.routerIP,
    port: config.routerPort,
    path: '/',
    headers: headers
}, (res) => {
    if(config.debug)console.log("Got response: " + res.statusCode);
    if(res.statusCode === 200){
        if(config.debug)console.log("Logged IN");

        let responseString = "";
        res.on("data", function(chunk) {
            responseString += chunk;
        });

        res.on("end", function () {
            if(config.debug)console.log(responseString);

            // get Admin IP
            let admin_ip = responseString.split(/adminLoggedIp = '(.*)';/);
            formattedJson.adminIP = admin_ip[1];

            // get Auth Mode
            let auth_mode = responseString.split(/sky_wlAuthMode = '(.*)';/);
            formattedJson.authMode = auth_mode[1];

            // get SSID
            let SSID = responseString.split(/sky_WirelessAllSSIDs = '(.*)';/);
            formattedJson.SSID = SSID[1];
            console.log("Done Vars 2");
        });
    }else if(res.statusCode === 401){
        console.log("Wrong Credentials");
    }else{
        console.log("HTTP ERROR | Response code - " + res.statusCode);
    }

}).on('error', function(e) {
    console.log("Got error: " + e.message);
});

// TODO: Send this to a PHP script for logging and display
// TODO: Sort the Timeout and properly check if all calls have completed
setTimeout(function(){console.log(JSON.stringify(formattedJson))}, 1000);


