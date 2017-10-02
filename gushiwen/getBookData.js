const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const async = require("async");
const mongoose = require("mongoose");
const q = require('q');

mongoose.Promise = q.Promise;
let options = {
    server: { poolSize: 5 }
}
let db = mongoose.connect('mongodb://localhost:27017/guwenbookDB', options);
mongoose.connection.on('connected', function () {
    console.log("数据库 连接成功");
})

let bookItem = mongoose.Schema({
    name: String,
    author: String,
    chapter: String,

    content: String,
    title: String,
    translator: String,
    translate: String,
    originUrl: String,
})

//保存出错的数据名称
let errSpiderCollection = 'errSpiderCollection';
var errSpiderDB = mongoose.Schema({
    dbName: String,
    bookName: String,
    title: String,
    url: String
})

let hasSavedCollection = 'hasSavedCollection';
var hasSavedDB = mongoose.Schema({
    dbName: String,
    bookName: String
})

let errDB = mongoose.model(errSpiderCollection, errSpiderDB);
let savedDB = mongoose.model(hasSavedCollection, hasSavedDB);



let chapterItem;
let origin = 'http://so.gushiwen.org';

//用来日志计数 当前书籍 共有多少页数据
let curBookCount = 0;
let curBookDB = '';
//保存抓取失败的db
let badDB = [];


let bookUrl = [];
let bookChapter = [];
let bookName = '';
let book = {};


//设置回调函数
let Watcher = function () {
    this.callback = '';
    this.count = 0;
    return {
        setCallback: function (callback) {
            this.callback = callback;
            this.count = 0;
        },
        execCallback: function () {
            this.count++;
            let _this = this;
            console.log('暂停10秒' + ' this.count: ' + this.count);
            setTimeout(function () {
                let obj = {
                    bookName: bookName,
                    dbName: curBookDB
                }
                console.log('this.count :' + _this.count);
                console.log('《' + bookName + '》' + ' 书目回调执行完毕！');
                _this.callback(null, obj);

            }, 5000);


        }
    }
}
let watcher = new Watcher();

// 获取 二级即 章节分类
let getUrl = function (website) {
    request(website, function (err, response, body) {
        let $, bookUrl = [], bookChapter = [];
        if (err) {
            console.log(err);
        }
        if (response && response.statusCode == 200) {

            $ = cheerio.load(body, { decodeEntities: false });
            bookName = $('.cont h1').text();
            $('.bookcont').map(function (i, el) {
                let $me, item;
                $me = $(this);
                item = {
                    chapter: $(el).find('strong').text(),
                    list: getListUrl($, el),
                    content: ''
                }

                bookUrl.push(item)

            })


        }
        book = {
            name: bookName,
            author: '',
            chapterUrl: bookUrl
        }
        getChapter(book);

    })
}


let getListUrl = function ($, selector) {
    let arr = [];
    $(selector).find('a').map(function (i, el) {
        let obj = {
            title: $(el).text(),
            url: origin + $(el).attr('href')
        }
        arr.push(obj)
    })
    return arr
}

function sleep(numberMillis) {
    console.log('爬虫暂停：' + numberMillis + '毫秒');
    let now = new Date();
    let exitTime = now.getTime() + numberMillis;
    while (true) {
        now = new Date();
        if (now.getTime() > exitTime)
            console.log('---------爬虫休眠 完毕 开始爬取---------')
        return;
    }
}

let length = 0;

let getChapter = function (obj) {
    let curBookArr = [];
    length = obj.chapterUrl.length;
    //记录当前执行一级目录遍历序号
    let curIndex = 0;
    obj.chapterUrl.forEach(function (item, i) {
        async.mapLimit(item.list, 1, function (series, callback) {

            //sleep  可以加上sleep 函数 做时间延迟
            getArticle(series, callback)
        }, function (err, result) {
            curIndex++;
            if (err) {
                console.log(err.bookName + '数据抓取失败，现在跳出本章节数据循环，进入下一章节抓取----------')
                if (length != curIndex) {
                    return
                } else {
                    console.log('---------getChapter 函数  数据抓取失败 ，且当前执行为最后一条，执行 execCallback() 跳出循环------------')
                    watcher.execCallback()
                    return
                }

            }
            curBookArr = curBookArr.concat(result)

            if (length != curIndex) {
                return
            }
            //保存数据

            chapterItem.create(curBookArr, function (err) {
                if (err) {
                    console.log(bookName + 'document 保存失败')
                }
            }).then(function (docs) {

                //爬取数据结束
                console.log('当前执行函数名:getChapter ' + bookName + ' 爬取完毕' + '--总页面数：' + curBookCount + '页; ' + '开始执行主线程 回调')
                let savedCollection = new savedDB({
                    dbName: curBookDB,
                    bookName: bookName,
                })
                savedCollection.save().then(function (res) {
                    console.log('---------getChapter 函数正常状态执行 execCallback()------------')
                    watcher.execCallback()
                })
            })




        })

    })

}

// 替换为本正则匹配
let replaceFront = {
    reg: /<p.*?>/g,
    replace: ''
};
let replaceEnd = {
    reg: /<\/p.*?>/g,
    replace: '<br/>'
}
let getArticle = function (series, callback) {
    request(series.url, function (err, response, body) {
        if (err) {
            let flag = false;
            console.log(curBookDB + '抓取数据失败');
            badDB.push({
                url: series.url,
                dbName: curBookDB,
                bookName: bookName
            })
            let errMsg = {
                dbName: curBookDB,
                bookName: bookName
            }
            console.log(bookName + ' 当前执行获取页面数据失败');
            //闭包执行错误数据保存
            saveErrDB(curBookDB, bookName, series)
            callback(errMsg, null)
            return
            // console.log(err);
            //  getArticle(series,callback)
            // callback(null, null)
            // return
        };
        curBookCount++;
        let $ = cheerio.load(body, { decodeEntities: false });
        //获取当前二级标题和三级标题
        let curChapter = $('.cont').find('h1').html() ?$('.cont').find('h1').html().replace(/<[^>].*>/g, '').trim() : '';

        curChapter = curChapter.split('·');
        let obj = {
            name: book.name,
            author: $('.source a').text(),
            chapter: curChapter[0],
            title: !!curChapter[1] ? curChapter[1] : '',
            translator: $('.right .source span').eq(1).text(),
            content: $('.contson').html() ? reg($('.contson').html(), replaceFront.reg, replaceFront.replace, curChapter[1]).replace(replaceEnd.reg, replaceEnd.replace) : noResourceNotice(series.url, curChapter, '没有内容'),
            translate: $('.shisoncont').html() ? reg($('.shisoncont').html(), replaceFront.reg, replaceFront.replace).replace(replaceEnd.reg, replaceEnd.replace).replace(/<[^>|^br].*?>/g, '') : noResourceNotice(series.url, curChapter, ' 没有翻译'),
            originUrl: series.url
        }
        // saveMongo(obj);
        console.log(bookName + ' ' + curChapter[0] + '     数据抓取完毕 ！')
        callback(null, obj)
    })
}

let saveErrDB = function (curDBName, curBookName, series) {
    errDB.find({
        dbName: curDBName,
        title: series.title,
        url: series.url
    }).then(function (res) {
        let errMsg = {
            dbName: curDBName
        };
        if (res.length === 0) {
            let errCollection = new errDB({
                dbName: curDBName,
                bookName: curBookName,
                title: series.title,
                url: series.url
            })
            errCollection.save().then(function () {
                console.log(curBookName + '   异步保存当前错误数据到ErrDB')
            })
        }
    })
}


let replaceStr = function (str, reg, replace) {
    if (!str) {
        return
    }
    return reg(str, replaceFront.reg, replaceFront.replace, curChapter[1]).replace(replaceEnd.reg, replaceEnd.replace)

}

let noResourceNotice = function (url, title, detail) {
    console.log('当前项：' + title + '  ' + detail + '  url :' + url);
    return ''
}

//正则替换
let reg = function (str, reg, replace, flag) {
    if (!str) {
        console.log(flag + ' 项没有数据')
        return
    } else {
        return str.replace(reg, replace)
    }

}

let init = function (url, bookName, dbName, callback) {
    console.log('init :-----爬取进入初始化函数------')
    console.log('init :--------当前爬取: ' + url + '  保存db: ' + dbName + '---------');

    //检索当前书目是否已经成功被保存
    savedDB.find({ dbName: dbName }, function (err, doc) {
        if (err) {
            console.log('当前查找失败' + err)
            return
        }
    }).then(function (doc) {
        if (doc.length > 0) {
            console.log('init: 当前书目: ' + bookName + ' 已经缓存 爬取下一本！')
            callback(null, null)
        } else {
            // 创建一个新的document 实例  初始化当前数据
            chapterItem = mongoose.model(dbName, bookItem);
            curBookDB = dbName;
            curBookCount = 0;
            bookUrl = [];
            bookChapter = [];
            bookName = '';
            book = {};
            watcher.setCallback(callback);
            getUrl(url)
        }
    })


}
//测试
// init('http://so.gushiwen.org/guwen/book_159.aspx','guwenbook123')
module.exports = {
    init: function (url, bookName, dbName, callback) {
        init(url, bookName, dbName, callback)
    }
};




//曲线救国 正则表达式 
// let aaa = data.replace(/<p.*?>/g,"")
// let aaa = data.replace(/<\/p.*?>/g,"/n")

//  let replaceFront = {
//     reg:/<p.*?>/g ,
//     replace:''
// };
//  let replaceEnd = {
//     reg:/<\/p.*?>/g,
//     replace:'\\n'
// }
//  let reg = function(str,reg,replace,callback){
//     return str.replace(reg,replace)
// }
//  let content = reg($('.shisoncont').html(),replaceFront.reg,replaceFront.replace).replace(replaceEnd.reg,replaceEnd.replace);
//  let ddd = content.replace(/<[^>|^br].*?>/g,'')