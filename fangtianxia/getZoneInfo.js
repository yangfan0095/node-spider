/**
 * 根据重庆各区域各个板块 查询各个版块内在售楼盘信息
 */
const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');

const async = require("async");

const mongoose = require("mongoose");
const iconv = require('iconv-lite');
const zlib = require('zlib');
const util = require('./util');

const Utils = util.Utils;
const DomCount = util.DomCount;
const conno = mongoose.connect('mongodb://localhost:27017/fangtianxia');
mongoose.connection.on('connected', function () {
    console.log("数据库 连接成功");
})
const baseUrl = 'http://newhouse.cq.fang.com/house/s/';
const origin = 'http://newhouse.cq.fang.com';
var itemUrl = 'b81';

// 楼盘信息
var housesList = mongoose.Schema({
    name: String,
    ftxhref: String,
    Zone: String,
    address: String,
    price: Number,
    priceDetail: String,
    type: Array,
    phoneNumber: String,
    imageUrl: String,
    city: String,
    title: String,
    zoneUrl: String,
    zoneDes: String,
    childZoneUrl: String,
    childZoneDes: String,
});
// 城市区域
let zone = mongoose.Schema({
    city: String,
    title: String,
    zoneUrl: String,
    zoneDes: String,
    childZoneUrl: String,
    childZoneDes: String
});

let houseData = conno.model('housesList', housesList);
let cityZone = conno.model('cityzone', zone);



//全局基础使用数据

let basicData = {
    page: '',
    totalCount: '',
}
var utils = new Utils()

let sleep = function (numberMillis) {
    console.log('等待一秒钟进入下一页爬取...');
    var now = new Date();
    var exitTime = now.getTime() + numberMillis;
    while (true) {
        now = new Date();
        if (now.getTime() > exitTime)
            return;
    }
}

// 获取分页正则表达式 Arr[1] 为当前页 Arr[2]为总页数
var reg = /(\d*)\/(\d*)/;
var domCount = new DomCount();
// 获取城市区域所有板块数据
let init = () => {
    // 获取所有板块
    cityZone.find({}, function (err, list) {
        if (err) {
            console.log('查询失败');
            return
        }
        asyncMap(list);
    })
}
let asyncMap = (list) => {
    async.mapLimit(list, 1, function (series, callback) {
        sleep(1000);
        let doc = series._doc;
        getItem(doc, callback);
    }, function (err, result) {
        if (err) {
            console.log(err);
            return
        }
        console.log('各个板块数据下载完成!')
    })
}

//获取每页详细数据
var getItem = function (doc, callback) {
    let curUrl = origin + doc.childZoneUrl;
    request(curUrl, { encoding: null }, function (err, response, body) {
        if (err) {
            console.log('当前页' + curUrl + ' 抓取数据失败， 抓取下一页')
            callback(null, null)
            return;
        }
        console.log(curUrl + ' 页面数据抓取成功， 正在解析...');
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
                let reg = /(\d*)\/(\d*)/;
                let li = $('.nhouse_list>div>ul>li');
                // 当前页面楼盘信息集合
                let curPageData = [];
                if (li.length === 0) {
                    callback(null, null)
                    return;
                }
                li.each(function (index, el) {
                    let address = $(el).find('.nlc_details .relative_message .address a').attr('title');
                    let obj = {
                        name: $(el).find('.nlc_details .house_value  .nlcd_name a').text().trim() || '', // 楼盘名称
                        ftxhref: $(el).find('.nlc_details .house_value  .nlcd_name a').attr('href') || '', // 楼盘名称链接
                        Zone: address, // 楼盘区域
                        address: address || '',// 楼盘地址
                        price: !($(el).find('.nlc_details .nhouse_price ').html()) ? 0 : utils.getPrice($(el).find('.nlc_details .nhouse_price ').text().trim()).price,// 楼盘价格 转换后
                        priceDetail: !($(el).find('.nlc_details .nhouse_price ').html()) ? '价格待定' : utils.getPrice($(el).find('.nlc_details .nhouse_price ').text().trim()).detail,// 楼盘价格 直接截取字符串
                        type: domCount.getType(el, $), // 楼盘类型
                        phoneNumber: $(el).find('.nlc_details .relative_message .tel p').text() || '', // 楼盘电话
                        imageUrl: $(el).find('.nlc_img a').attr('href') || '', // 图片地址
                    }
                    let newObj = Object.assign(obj, {
                        city: doc.city,
                        title: doc.title,
                        zoneUrl: doc.city,
                        zoneDes: doc.zoneDes,
                        childZoneUrl: doc.childZoneUrl,
                        childZoneDes: doc.childZoneDes
                    });
                    curPageData.push(newObj);
                    if (index === li.length - 1) {
                        console.log('当前页面数据抓取完毕，开始保存...');
                        saveCurPage(curPageData, callback);
                    }
                })
            })
        }
    })
}
var saveCurPage = function (list, callback) {
    list.forEach((item, index) => {
        saveMongo(item);
        if (index === list.length - 1) {
            console.log('当前数据保存完毕，开始抓取下一页...');
            var model = new cityZone;
            model.update({ childZoneUrl: item.childZoneUrl }, {
                '$set': { 'oct-7': false }
            }).then(() => {
                console.log('板块信息数据更新成功, 进入下一个回调');
                callback(null, null);
            });
        }
    })
}
// 保存到mongoDB
var saveMongo = function (obj) {
    var Model = new houseData(obj);
    Model.save(function (err) {
        if (err) {
            console.log(err)
            return
        }
    })
}
init();