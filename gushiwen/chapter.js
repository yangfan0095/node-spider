const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const async = require("async");
const mongoose = require("mongoose");
const q = require('q');

let getBookData = require('./getBookData')

let options = {
    server: {
        poolSize: 5
    }
}
mongoose.Promise = q.Promise;
let conno = mongoose.createConnection('mongodb://47.52.115.169/guwen', options);
mongoose.connection.on('connected', function () {
    console.log("远程数据库 连接成功");
})
let bookMap = mongoose.Schema({
    dbName: String,
    bookName: String,
    bookUrl: String,
    bookDetail: String,
})
let bookListModel = conno.model('booklists', bookMap);
let bookList = new bookListModel();

// 数据库查询一级书目
bookListModel.find({}, function (err, data) {
    if (err) {
        console.log('查询书记目录失败')
        return;
    }
})


//根据一级书目进入书籍页面 抓取书籍页面章节信息和章节链接


/**
 * 遍历链接 发起并行抓取操作 这里设置并发为1
 * @param {*} list 
 */
const asyncGetChapter = (list) => {
    async.mapLimit(data, 1, (series, callback) => {
        let doc = series._doc;
        getChapterInfo(doc.bookUrl, doc.bookName, callback)
    }, (err, result) => {
        if (err) {
            console.log(err);
        }

    })
}
const getChapterInfo = (url, bookName, callback) => {

    request(url, function (err, response, body) {
        let $, bookUrl = [],
            bookChapter = [];
        if (err) {
            console.log(err);
        }
        if (response && response.statusCode == 200) {

            $ = cheerio.load(body, {
                decodeEntities: false
            });
            bookName = $('.cont h1').text();
            $('.bookcont').map(function (i, el) {
                let $me, item;
                $me = $(this);
                item = {
                    chapter: $(el).find('strong').text(),
                    list: getListUrlAndTitle($, el),
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
    })
}

/**
 * 获取一级章节内所有二级章节名 和对应url
 * @param {*} $ 
 * @param {*} selector 
 */
let getListUrlAndTitle = function ($, selector) {
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

// 保存章节信息和 链接到mongodb