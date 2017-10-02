var request = require('request');
var cheerio = require('cheerio');
var fs = require('fs');

var async = require("async");

var mongoose = require("mongoose");
var iconv = require('iconv-lite');
var zlib = require('zlib');
var gunzipStream = zlib.createGunzip();
var raw = fs.createReadStream('index.html');

mongoose.connect('mongodb://localhost:27017/fangtianxia');
mongoose.connection.on('connected', function () {
    console.log("数据库 连接成功");
})

var baseUrl = 'http://newhouse.cd.fang.com/house/s/';
// 在售楼盘b81
var itemUrl = 'b81';


var houseInfo = mongoose.Schema({
    name: String,
    ftxhref: String,
    Zone: String,
    address: String,
    price: Number,
    priceDetail: String,
    star: Number,
    hot: Boolean,
    type: Array,
    phoneNumber: String,
    imageUrl: String,
})

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
                detail: result[0],
                price: parseInt(result[1]),
                unit: result[2]
            }
            return obj
        },
        //根据总页数 生成每页的url 数组
        getPageArr: function (totalCount) {
            let pageUrlArr = []
            for (let i = 1; i <= totalCount; i++) {
                pageUrlArr.push(baseUrl + itemUrl + startPagePosition(i))
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

// 入口函数
var enterMainPage = function () {
    request(baseUrl, function (err, response, body) {
        if (err) {
            console.log(err)
            return
        }
        if (response.headers['content-encoding'].indexOf('gzip') != -1) {
            var a = response.pipe(gunzipStream).pipe(raw);
            try {
                var data = fs.readFileSync('index.html', 'utf-8');
                body = data;
            } catch (err) {
                // 出错了
                console.log('同步读取文件失败')
            }

        }
        body = iconv.decode(body, 'gzip');
        let $ = cheerio.load(body, { decodeEntities: false })
        basicData.totalCount = utils.getTotalCount($('#allUrl span').text());
        basicData.page = utils.getTotalCount($('.contentListf .otherpage span').text())

        let pageUrlArr = utils.getPageArr(basicData.totalCount);
        asyncMap(pageUrlArr)
    })
}

// 获取每一页详细数据
var asyncMap = function (pageUrlArr) {
    //暂且用这种丑陋的方式来判断数组类型
    // if (Object.toString.call(pageUrlArr) != 'object Array') {
    //     return
    // }
    async.mapLimit(pageUrlArr, 3, function (series, callback) {
        sleep(1000)
        getItem(series, callback)
    }, function (err, result) {
        if (err) {
            console.log(err)
            return
        }

        console.log('-------狗日的 我擦 数据抓取到了 !------')

    })

}
//dom计算函数
let DomCount = function () {
    return {
        starCount: function (el) {
            let orangeStar = $(el).find('.nlc_details .house_value  .star_group li').filter('.orange-star').length;
            let halfStar = $(el).find('.nlc_details .house_value  .star_group li').filter('.half-star').length;
            return orangeStar * 1 + halfStar * 0.5
        },
        //获取楼盘类型， 改善型 ，刚需...
        getType: function (el) {
            let list = $(el).find('.nlc_details .fangyuan a');
            let arr = [];
            list.each(function (index, el) {
                arr.push(el.text())
            })
            return arr
        }
    }
}
var domCount = new DomCount();



//获取每页详细数据
var getItem = function (url, callback) {

    request(url, function (err, response, body) {
        if (err) {
            console.log('当前页' + url + ' 抓取数据失败， 抓取下一页')
            callback(null, null)
            return
        }
        let $ = cheerio.load(body, { decodeEntities: false });
        let li = $('.nhouse_list>div>ul>li');
        li.each(function (index, el) {
            let address = $(el).find('.nlc_details .relative_message .address a').attr('title');
            let obj = {
                name: $(el).find('.nlc_details .house_value  .nlcd_name a').text() || '',
                ftxhref: $(el).find('.nlc_details .house_value  .nlcd_name a').attr('href') || '',
                Zone: utils.getZone(address),
                address: address || '',
                price: utils.getPrice($(el).find('.nlc_details .nhouse_price ').text().trim()).price,
                priceDetail: utils.getPrice($(el).find('.nlc_details .nhouse_price ').text().trim()).detail,
                star: domCount.getStar(el),
                hot: $(el).find('.nlc_details .house_value .mr10').length > 0 ? true : false,
                type: domCount.getType(el),
                phoneNumber: $(el).find('.nlc_details .relative_message .tel p').text() || '',
                imageUrl: $(el).find('.nlc_img a').attr('href') || '',
            }

            saveMongo(obj)
            callback(null, obj)
        })

    })
}

// 保存到mongoDB
var saveMongo = function (obj) {

    var Model = new houseInfo(obj);

    Model.save(function (err) {
        if (err) {
            console.log(err)
            return
        }
        console.log(obj.name + '  保存到数据库成功!')
    })
}


enterMainPage()
