//获取一级书目信息
var request = require('request');
var cheerio = require('cheerio');
var fs = require('fs');
var async = require("async");
var mongoose = require("mongoose");
var q = require('q');

mongoose.Promise = q.Promise;
mongoose.connect('mongodb://47.52.115.169:27017/guwen');
mongoose.connection.on('connected', function () {
    console.log("数据库 连接成功");
})

//具体书内容表
var bookItem = mongoose.Schema({
    name: String,
    author: String,
    chapter: String,

    content: String,
    title: String,
    translator: String,
    translate: String,
    originUrl: String
})

//建立一级书目，与数据库的映射关系
var bookMap = mongoose.Schema({
    dbName: String,
    bookName: String,
    bookUrl: String,
    bookDetail: String,
    imageUrl:String
})

var chapterItem = mongoose.model('chapterItem', bookItem);
let bookModel = mongoose.model('bookList', bookMap);
var origin = 'http://so.gushiwen.org';
var website = 'http://so.gushiwen.org/guwen/book_5.aspx';

//所有基准url 
var baseUrl = 'http://so.gushiwen.org/guwen/Default.aspx?p=';
var totalListPage = 18;
var prefix = 'guwenbook';

// 每本书初始化， 1 首先保存成一个model ,  2 获取书的内容

//初始化
var init = function () {

    console.log('---------好戏开始，dang dang dang dang！--------')
    var pageUrlList = getPageUrlList(totalListPage, baseUrl);
    getBookList(pageUrlList)
}

// 得到当前总页数链接
var getPageUrlList = function (totalCount, baseUrl) {
    let pageUrlList = [];
    for (let i = 1; i <= totalCount; i++) {
        pageUrlList.push(baseUrl + i)
    }
    return pageUrlList

}

// 得到当前页 书籍一级信息
var getCurPage = function (bookUrl, callback) {
    request(bookUrl, function (err, response, body) {
        if (err) {
            console.log('当前链接发生错误，url地址为:' + bookUrl);
            callback(null, null)
            return
        } else {
            $ = cheerio.load(body, { decodeEntities: false });
            let curBookName = $('.sonspic h1').text();
            let curBookList = getCurPageBookList($, body);
            callback(null, curBookList)
        }


    })
}

//通过闭包 生成dbName  @prefix 输入前缀
var count = 0;
var getDBName = function (prefix) {
    return prefix + count++
}

//获取当前页 书籍内容保存在数组中
var getCurPageBookList = function ($, body) {
    let BookListDom = $('.sonspic .cont');
    let BookList = [];
    BookListDom.each(function (index, el) {
        let obj = {
            dbName: getDBName(prefix),
            bookName: $(el).find('p b').text(), // 书名
            bookUrl: origin + $(el).find('p a').attr('href'), //书目链接
            bookDetail: $(el).find('p').eq(1).text().trim(),// 书籍介绍
            imageUrl:$(el).find('a img').attr('src'),//书籍图片地址
        }
        BookList.push(obj)
    })
    return BookList
}

//得到书籍具体信息
var getBookList = function (pageUrlList) {
    async.mapLimit(pageUrlList, 3, function (series, callback) {
        getCurPage(series, callback)
    }, function (err, result) {
        if (err) {
            console.log('------------异步执行出错!----------')
            return
        }
        getAllBookList(result);

    })

}
var saveDB = function (obj) {
    //严格这里应该加上类型判别 ，这里偷个懒  
    let dbModel = new bookModel(obj);
    dbModel.save(function (err) {
        if (err) {
            console.log(err)
            return
        }
        console.log(obj.bookName + '  数目一级内容保存到数据库成功!')
    })
}

var getAllBookList = function (Arr) {
    let a = Arr;
    Arr.forEach(function(Item,index){
        Item.forEach(function(obj,index){         
            saveDB(obj);
        })
    })
}


init();

