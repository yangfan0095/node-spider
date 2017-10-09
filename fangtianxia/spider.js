var request = require('request');
var cheerio = require('cheerio');
var fs = require('fs');

var async = require("async");

var mongoose = require("mongoose");
var iconv = require('iconv-lite');
var zlib = require('zlib');
// var gunzipStream = zlib.createGunzip();

let conno = mongoose.connect('mongodb://localhost:27017/fangtianxia2sf');
mongoose.connection.on('connected', function () {
    console.log("数据库 连接成功");
})

// var baseUrl = 'http://newhouse.cd.fang.com/house/s/';
var baseUrl = 'http://esf.cd.fang.com/house/i3';
// 在售楼盘b81
var itemUrl = 'b81';


var houseInfo = mongoose.Schema({
    name: String,
    ftxhref: String,
    Zone: String,
    address: String,
    price: Number,
    priceDetail: String,
    // star: Number, // 非源网页render 暂时不做
    type: Array,
    phoneNumber: String,
    imageUrl: String,
});
let houseData = conno.model('houseInfo', houseInfo);

//全局基础使用数据

let basicData = {
    page: '',
    totalCount: '',
}

let Utils = function () {

    //统一判断传入值是否为string
    let strType = function (str) {
        if (!str) {
            console.log('传入数据为' + str + ' 不能进行正则匹配！')
            return false
        }
        return true
    }
    //当前页数起点位置 -b91为第一页
    let startPagePosition = function (No) {
        return '-b9' + No
    }
    return {
        //去掉（488） 总页数外面() 返回数字条数 488 详细参见 exec()方法
        getTotalCount: function (str) {
            if (!strType(str)) {
                return
            }
            let reg = /\d+/;
            return parseInt(reg.exec(str)[0])
        },
        getTotalPage: function (str) {
            if (!strType(str)) {
                return
            }
            // 输入 '2/23 44'  输出 /23 23
            let reg = /\/(\d+)/;
            return parseInt(reg.exec(str)[1])
        },
        getZone: function (str) {
            if (!strType(str)) {
                return
            }
            let reg = /^\[(.+)].*/;
            return reg.exec(str)[1]
        },
        //var reg = /(\d+)(.+)\/.*/; ttt = reg.exec(str); ["7800元/㎡", "7800", "元", index: 0, input: "7800元/㎡"]
        getPrice: function (str) {
            let reg = /(\d+)(.+)\/.*/;
            let result = reg.exec(str);
            let obj = {
                detail: !result ? '' : result[0],
                price: !result ? 0 : parseInt(result[1]),
                unit: !result ? '' : result[2]
            }
            return obj
        },
        //根据总页数 生成每页的url 数组
        getPageArr: function (totalCount) {
            let pageUrlArr = []
            for (let i = 1; i <= totalCount; i++) {
                let convertPage = i < 10 ? '0' + i : i;
                pageUrlArr.push(baseUrl + convertPage + '/');
            }
            return pageUrlArr

        }

    }
}
var utils = new Utils()

let sleep = function (numberMillis) {
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

// 入口函数
var enterMainPage = function () {
    request(baseUrl, { encoding: null }, function (err, response, body) {
        if (err) {
            console.log(err)
            return
        }
        if (response.headers['content-encoding'].indexOf('gzip') != -1) {
            // var a = response.pipe(gunzipStream).pipe(raw);
            zlib.gunzip(body, function (err, dezipped) {
                if (err) {
                    console.log('解压出错');
                }
                body = iconv.decode(dezipped, 'gbk');
                let $ = cheerio.load(dezipped, { decodeEntities: false })
                basicData.totalCount = utils.getTotalCount($('#allUrl span').text());
                let pageString = $('.contentListf .otherpage').text();
                basicData.curPage = parseInt(pageString.match(reg)[1]);
                basicData.totalPage = parseInt(pageString.match(reg)[2]);
                let pageUrlArr = utils.getPageArr(basicData.totalPage);
                console.log('开始执行异步页面数据获取');
                asyncMap(pageUrlArr)
            });
        }
    })
}

// 获取每一页详细数据
var asyncMap = function (pageUrlArr) {
    //暂且用这种丑陋的方式来判断数组类型
    // if (Object.toString.call(pageUrlArr) != 'object Array') {
    //     return
    // }
    async.mapLimit(pageUrlArr, 1, function (series, callback) {
        sleep(1000);
        getItem(series, callback);
    }, function (err, result) {
        if (err) {
            console.log(err)
            return
        }
        console.log('-------狗日的 我擦 数据终于抓取完了 !------');
    })

}
//dom计算函数
let DomCount = function () {
    return {
        starCount: function (el, $) {
            let orangeStar = $(el).find('.nlc_details .house_value  .star_group li').filter('.orange-star').length;
            let halfStar = $(el).find('.nlc_details .house_value  .star_group li').filter('.half-star').length;
            return orangeStar * 1 + halfStar * 0.5
        },
        //获取楼盘类型， 改善型 ，刚需...
        getType: function (el, $) {
            let listString = $(el).find('.nlc_details .fangyuan a').text();
            let arr = listString.split(' ');
            return arr
        }
    }
}
var domCount = new DomCount();



//获取每页详细数据
var getItem = function (url, callback) {
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
                let li = $('.nhouse_list>div>ul>li');
                // 当前页面楼盘信息集合
                let curPageData = [];
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
                    curPageData.push(obj);
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
            callback(null, null);
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


enterMainPage()
