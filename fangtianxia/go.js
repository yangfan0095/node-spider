/**
 * 获取各区域板块数据
 */
const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');

const async = require("async");

const mongoose = require("mongoose");
const iconv = require('iconv-lite');
const zlib = require('zlib');
const conno = mongoose.connect('mongodb://localhost:27017/fangtianxia');
mongoose.connection.on('connected', function () {
    console.log("数据库 连接成功");
})

const baseUrl = 'http://newhouse.cq.fang.com/house/s/';
const origin = 'http://newhouse.cq.fang.com';

// 城市区域
let zone = mongoose.Schema({
    city: String,
    title: String,
    zoneUrl: String,
    zoneDes: String,
    childZoneUrl: String,
    childZoneDes: String
});
let cityZone = conno.model('cityzone', zone);

let sleep = function (numberMillis) {
    let now = new Date();
    let exitTime = now.getTime() + numberMillis;
    while (true) {
        now = new Date();
        if (now.getTime() > exitTime)
            return;
    }
}

// 获取分页正则表达式 Arr[1] 为当前页 Arr[2]为总页数
let reg = /(\d*)\/(\d*)/;

// 获取区域链接
let getZoneUrl = function () {
    request(baseUrl, { encoding: null }, function (err, response, body) {
        if (err) {
            console.log(err)
            return
        }
        if (response.headers['content-encoding'].indexOf('gzip') != -1) {
            zlib.gunzip(body, function (err, dezipped) {
                if (err) {
                    console.log('解压出错');
                }
                body = iconv.decode(dezipped, 'gbk');
                let $ = cheerio.load(body, { decodeEntities: false });
                let zoneEle = $('#quyu_name a');
                let zonArr = [];
                zoneEle.each((index, el) => {
                    let url = $(el).attr('href');
                    let des = $(el).text().trim();
                    zonArr.push({
                        city: 'chongqing',
                        title: '重庆',
                        zoneUrl: url,
                        zoneDes: des,
                    })
                    if (index === zoneEle.length - 1) {
                        getChildZoneUrl(zonArr);
                    }
                });
            });
        }
    })
}

// 通过一级区域获取二级区域
let getChildZoneUrl = (zonArr) => {
    let list = zonArr;
    async.mapLimit(list, 1, function (series, callback) {
        goChildZone(series, callback);
    }, function (err, result) {
        if (err) {
            console.log(err);
            return;
        }
        console.log('二级区域板块 抓取完成!');
    })
}

// 获取二级区域板块
let goChildZone = (series, callback) => {
    let url = origin + series.zoneUrl;
    request(url, { encoding: null }, function (err, response, body) {
        if (err) {
            console.log('当前页' + url + ' 抓取数据失败， 抓取下一页')
            callback(null, null)
            return
        }
        console.log(url + ' 页面数据抓取成功， 正在解析...');
        // 对每页数据进行解压缩
        if (response.headers['content-encoding'].indexOf('gzip') != -1) {
            zlib.gunzip(body, function (err, dezipped) {
                if (err) {
                    console.log('解压出错');
                    callback(null, null)
                    return;
                }
                body = iconv.decode(dezipped, 'gbk');
                console.log('页面数据解压缩成功!');
                // 操作dom 抓取数据
                let $ = cheerio.load(body, { decodeEntities: false });
                let childZoneElememt = $('.quyu ol li a');
                if (childZoneElememt.length === 0) {
                    callback(null, null);
                    return;
                }
                childZoneElememt.each((index, el) => {
                    let url = $(el).attr('href');
                    let des = $(el).text().trim();
                    let obj = {
                        childZoneUrl: url,
                        childZoneDes: des
                    }

                    let newObj = Object.assign(series, obj);

                    // 保存到数据库中
                    let Model = new cityZone(newObj);
                    Model.save(function (err) {
                        if (err) {
                            console.log(err)
                            return
                        }
                    });
                    // 执行回调
                    if (index === childZoneElememt.length - 1) {
                        callback(null, null);
                    }
                });
            })
        }
    })
}

getZoneUrl();
