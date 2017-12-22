const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const async = require("async");
const mongoose = require("mongoose");
const q = require('q');
const logger = require('./log');

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
});
// 目录表
let bookMap = mongoose.Schema({
    dbName: String,
    bookName: String,
    bookUrl: String,
    bookDetail: String,
});
// 章节表
let chapterMap = mongoose.Schema({
    chapter: String,
    section: String,
    url: String,
    dbName: String,
    bookName: String,
    author: String,
})
let bookListModel = conno.model('booklists', bookMap);
let chapterListModel = conno.model('chapterlists', chapterMap);
let bookList = new bookListModel();
let chapterInstance = new chapterListModel();
const origin = 'http://so.gushiwen.org';
// 数据库查询一级书目
bookListModel.find({}, function (err, data) {
    if (err) {
        logger.error('查询书记目录失败');
        return;
    }
    asyncGetChapter(data);
});


//根据一级书目进入书籍页面 抓取书籍页面章节信息和章节链接


/**
 * 遍历链接 发起并行抓取操作 这里设置并发为1
 * @param {*} list 
 */
const asyncGetChapter = (list) => {
    async.mapLimit(list, 1, (series, callback) => {
        let doc = series._doc;
        let bookInfo = {
            dbName: doc.dbName,
            bookName: doc.bookName,
            author: doc.author,
        }
        getChapterInfo(doc.bookUrl, bookInfo, callback)
    }, (err, result) => {
        if (err) {
            console.log(err);
        }
        logger.info('数据抓取结束:' + curDbName);

    })
}
/**
 * 根据url  进入章节 执行爬虫任务
 * @param {*} url 
 * @param {*} bookInfo 
 * @param {*} callback 
 */
const getChapterInfo = (url, bookInfo, callback) => {
    logger.info('开始抓取:' + url);
    console.time('bookSpendAllTime');
    // 测试 : 'http://so.gushiwen.org/guwen/book_27.aspx'
    request(url, function (err, response, body) {
        let $, bookUrl = [],
            bookChapter = [];
        if (err) {
            logger.error('抓取页面信息失败，页面链接：' + url);
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
        let sectionList = getSectionFromChapter(bookUrl, bookInfo);
        logger.info(bookInfo.bookName + '数据抓取结束,' + '开始保存...');
        saveMongoDB(sectionList, callback);
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

/**
 * 遍历二级章节 返回文档 行数据
 * @param {*} chapterList 
 * @param {*} bookInfo 
 */
const getSectionFromChapter = (chapterList = [], bookInfo) => {
    let sectionArr = [];
    chapterList.map((item, index) => {
        let tempArr = item.list.map((childItem, index) => {
            return {
                chapter: item.chapter,
                section: childItem.title,
                url: childItem.url,
                dbName: bookInfo.dbName,
                bookName: bookInfo.bookName,
                author: bookInfo.author,
            };
        });
        sectionArr = sectionArr.concat(tempArr);
    });
    return sectionArr;
}
/**
 * 保存数据到mongoDB
 */
const saveMongoDB = async(chapterList, callback) => {
    let length = chapterList.length;
    let curDbName = chapterList[0].dbName;
    let bookName = chapterList[0].bookName;
    if (length === 0) {
        logger.warn('抓取数据长度为空，执行下一条数据。' + 'bookName:' + bookName + 'dbName: ' + curDbName);
        callback(null, null);
    }
    let dbLength = await chapterListModel.count({
        dbName: curDbName
    });
    let remoteBookList = await chapterListModel.distinct('dbName');
    let curSavedLength = remoteBookList.length;
    logger.info('当前数据库已保存' + curSavedLength);
    if (dbLength === length) {
        logger.warn('抓取数据与数据库保存数据默认条数相同，默认已存在，执行下一条数据。' + 'bookName:' + bookName + 'dbName: ' + curDbName);
        callback(null, null);
        return;
    }
    console.time('mongoSaveSpendTime');
    chapterListModel.collection.insert(chapterList, (err, doc) => {
        if (err) {
            logger.error('数据插入失败，进入下一组!' + 'bookName:' + bookName + 'dbName: ' + curDbName);
            callback(null, null);
            return;
        }
        console.timeEnd('mongoSaveSpendTime');
        logger.info('数据保存成功!' + 'bookName:' + bookName + 'dbName: ' + curDbName);
        let num = Math.random() * 700 + 800;
        await sleep(num);
        console.timeEnd('bookSpendAllTime');
        callback(null, null);
    })
}
/**
 * sleep函数
 * @param {*} times 
 */
const sleep = async(times) => {
    logger.info('当前爬虫自动休眠' + times + 'ms');
    let res = await setTimeout(() => true, times);
    return res;
}
// 保存章节信息和 链接到mongodb