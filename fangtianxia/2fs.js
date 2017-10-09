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

var baseUrl = 'http://esf.cd.fang.com/house/i3';
var sourceUrl = 'http://esf.cd.fang.com/'; // 网站origin
var houseInfo = mongoose.Schema({
    des: String, // 房屋出售标题
    url: String,//url地址
    layout: String,// 户型类型 三室一厅
    floor: String,//楼层信息
    ddirectiones: String,// 朝向
    age: String,// 建筑年代
    name: String,//楼盘名称
    addressUrl: String,//小区二手房url链接
    address: String,//地址
    agentUrl: String,//中介链接
    area: Number,// 面积
    areaType: String,//面积类型
    price: Number,//总价
    unitPrice: Number,//单价
    yearLabel: String,// 已满年限特征
    train: String,//地铁信息
});
let houseData = conno.model('houseInfo', houseInfo);
let urlList = mongoose.Schema({
    url: String,
    type: String
})
let urlListData = conno.model('2sfUrlList', urlList);
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
            baseUrl = 'http://esf.cd.fang.com/house/i3';
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
    baseUrl = 'http://esf.cd.fang.com/house/i3/';
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
                let $ = cheerio.load(body, { decodeEntities: false })
                let pageString = $('.listBox .menu .other .fy_text').text().trim();
                basicData.curPage = parseInt(pageString.match(reg)[1]);
                basicData.totalPage = parseInt(pageString.match(reg)[2]);
                let pageUrlArr = utils.getPageArr(basicData.totalPage);

                // asyncMap(pageUrlArr)
                pageUrlArr.forEach((item, index) => {
                    save2fsUrl({
                        url: item,
                        type: '2sf'
                    });
                    if (index === pageUrlArr.length - 1) {
                        console.log('地址保存完毕');
                    }
                })

            });
        }
    })
}

/**
 * 保存二手房链接 
 * @param {*} obj urlList类型
 */
let save2fsUrl = (obj) => {
    var Model = new urlListData(obj);
    Model.save(function (err) {
        if (err) {
            console.log(err)
            return
        }
    })
}

// enterMainPage(); // 获取所有房源url 保存到数据库

var getPageList = () => {
    urlListData.find({}, function (err, data) {
        if (err) {
            console.log('查询失败');
            return
        }
        asyncMap(data);
    })
}
getPageList();

var asyncMap = function (pageUrlArr) {
    async.mapLimit(pageUrlArr, 1, function (series, callback) {
        // sleep(1000);
        let doc = series._doc;
        getItem(doc.url, callback);
    }, function (err, result) {
        if (err) {
            console.log(err);
            return
        }
        if (curIndex !== spiderArr.length - 1) {
            curIndex++;
            console.log('-----开始爬取下一组-----');
            asyncList();
        } else {
            console.log('-------狗日的 我擦 数据终于抓取完了 !------');
        }

    })
}

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
                let li = $('.houseList dl');
                // 当前页面楼盘信息集合
                let curPageData = [];
                li.each(function (index, el) {
                    // 楼层信息提取方法
                    let mt12 = !($(el).find('dd .mt12').text().trim()) ? [] : $(el).find('dd .mt12').text().trim().replace(/\s+/g, "").split('|');
                    let mtInfo = getDetalInfo(mt12);
                    //总价
                    let price = !$(el).find('dd .moreInfo .price').text().trim() ? 0 : parseFloat($(el).find('dd .moreInfo .price').text().trim());
                    // 单价
                    let unitPrice = !$(el).find('dd .moreInfo .danjia').text().trim() ? 0 : parseFloat($(el).find('dd .moreInfo .danjia').text().trim().match(/\d+/g));
                    obj = {
                        des: $(el).find('dd .title').text().trim(), // 房屋出售标题
                        url: sourceUrl + $(el).find('dd .title a').attr('href'),//url地址
                        layout: mtInfo.layout,// 户型类型 三室一厅
                        floor: mtInfo.floor, //楼层信息
                        direction: mtInfo.direction,// 朝向
                        age: mtInfo.age,// 建筑年代
                        name: $($(el).find('dd .mt10')[0]).find('a').text().trim(), //楼盘名称
                        addressUrl: $($(el).find('dd .mt10')[0]).find('a').attr('href'), //小区二手房url链接
                        address: $(el).find('dd .mt10 .iconAdress').text().trim(),//地址
                        agentUrl: $(el).find('dd .gray6 a').attr('href'),//中介链接
                        area: domCount.getAreaDeatil($(el).find('dd .area p').text().trim()).area,// 面积
                        areaType: domCount.getAreaDeatil($(el).find('dd .area p').text().trim()).type,//面积类型
                        price: price,//总价
                        unitPrice: unitPrice,//单价
                        yearLabel: domCount.getYearType(el, $),// 已满年限特征
                        train: $(el).find('dd .mt8 .train'),//地铁信息
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
        },
        // 二手房 获取楼盘面积 面积类型
        getAreaDeatil(str) {
            let obj = {
                area: 0,
                type: '建筑面积'
            };
            if (!str) {
                return obj;
            }
            let arr = str.split('㎡');
            obj.area = arr[0];
            obj.type = arr[1];
            return obj;
        },
        // 获取 满二年 满五年 相关信息
        getYearType(el, $) {
            let arr = [];
            let list = $(el).find('dd .mt8 .colorPink').length > 0 ? true : false;
            if (list) {
                $(el).find('dd .mt8 .colorPink').each((index, dom) => {
                    arr.push($(dom).text().trim());
                    if (index === $(el).find('dd .mt8 .colorPink').length) {
                        return arr;
                    }
                })
            } else {
                return arr;
            }
        }
    }
}
var domCount = new DomCount();

// 楼层信息 户型 朝向 建筑年代 提取方法
function getDetalInfo(Arr) {
    let obj = {
        layout: '',
        floor: '',
        direction: '',
        age: '',
    };
    Arr.forEach((item, index) => {
        if (item.includes('室') || item.includes('厅')) {
            obj.layout = item;
        }
        if (item.includes('层')) {
            obj.floor = item;
        }
        if (item.includes('向') || item.includes('东') || item.includes('南') || item.includes('西') || item.includes('北')) {
            obj.direction = item;
        }
        if (item.includes('年代')) {
            obj.age = item;
        }
    });
    return obj;
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
        console.log(obj.name + '保存数据成功')
    });
}
